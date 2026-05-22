import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { shouldIgnoreFileChange } from "../src/auto-sync.js";

interface MockUi {
  notify: ReturnType<typeof vi.fn>;
  setStatus: ReturnType<typeof vi.fn>;
}

function createMockCtx(cwd: string): ExtensionContext {
  const ui: MockUi = {
    notify: vi.fn(),
    setStatus: vi.fn(),
  };

  return {
    hasUI: true,
    cwd,
    ui: ui as unknown as ExtensionContext["ui"],
    sessionManager: {} as unknown as ExtensionContext["sessionManager"],
    signal: undefined,
    modelRegistry: {} as unknown as ExtensionContext["modelRegistry"],
    model: undefined,
    getSystemPrompt: vi.fn(() => ""),
    getContextUsage: vi.fn(() => null),
    isIdle: vi.fn(() => true),
    abort: vi.fn(),
    hasPendingMessages: vi.fn(() => false),
    shutdown: vi.fn(),
    compact: vi.fn(),
  } as unknown as ExtensionContext;
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

async function flushAsync(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (condition()) return;
    await flushAsync();
  }

  throw new Error("condition was not met");
}

async function waitForEventually(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error("condition was not met");
}

function createMockPi(
  execImpl = async () => ({
    stdout: "CodeGraph sync completed.",
    stderr: "",
    code: 0,
  }),
) {
  const eventHandlers = new Map<string, Function[]>();
  const pi = {
    exec: vi.fn(execImpl),
    sendMessage: vi.fn(),
    registerTool: vi.fn(),
    registerCommand: vi.fn(),
    on: vi.fn((event: string, handler: Function) => {
      if (!eventHandlers.has(event)) eventHandlers.set(event, []);
      eventHandlers.get(event)!.push(handler);
    }),
  } as unknown as ExtensionAPI;

  return { pi, eventHandlers };
}

async function withCodegraphDir(fn: (cwd: string) => Promise<void>) {
  const tmp = await mkdtemp(join(tmpdir(), "pi-codegraph-auto-sync-"));
  await mkdir(join(tmp, ".codegraph"));

  try {
    await fn(tmp);
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

describe("auto sync", () => {
  it("sincroniza no início do turno quando .codegraph/ existe", async () => {
    await withCodegraphDir(async (cwd) => {
      const { pi, eventHandlers } = createMockPi();
      const mod = await import("../index.js");
      mod.default(pi);

      const handlers = eventHandlers.get("before_agent_start") ?? [];
      const ctx = createMockCtx(cwd);
      await handlers[0]?.({}, ctx);

      expect(pi.exec).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining(["sync", cwd, "--quiet"]),
        expect.objectContaining({ timeout: 30000 }),
      );
    });
  });

  it("sincroniza após edit/write bem-sucedidos", async () => {
    await withCodegraphDir(async (cwd) => {
      const { pi, eventHandlers } = createMockPi();
      const mod = await import("../index.js");
      mod.default(pi);

      const handler = (eventHandlers.get("tool_result") ?? [])[0];
      const ctx = createMockCtx(cwd);
      await handler?.({ toolName: "edit", isError: false }, ctx);
      await handler?.({ toolName: "write", isError: false }, ctx);

      expect(pi.exec).toHaveBeenCalledTimes(2);
      expect(pi.exec).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining(["sync", cwd, "--quiet"]),
        expect.objectContaining({ timeout: 30000 }),
      );
    });
  });

  it("agenda outro sync quando edit/write ocorre durante sync em andamento", async () => {
    await withCodegraphDir(async (cwd) => {
      const firstSync = createDeferred<{
        stdout: string;
        stderr: string;
        code: number;
      }>();
      const secondSync = createDeferred<{
        stdout: string;
        stderr: string;
        code: number;
      }>();
      const { pi, eventHandlers } = createMockPi(
        vi
          .fn()
          .mockImplementationOnce(() => firstSync.promise)
          .mockImplementationOnce(() => secondSync.promise),
      );
      const mod = await import("../index.js");
      mod.default(pi);

      const handler = (eventHandlers.get("tool_result") ?? [])[0];
      const ctx = createMockCtx(cwd);
      const firstRun = handler?.(
        { toolName: "edit", isError: false },
        ctx,
      ) as Promise<void>;
      await waitFor(
        () =>
          (pi.exec as unknown as ReturnType<typeof vi.fn>).mock.calls.length ===
          1,
      );

      const secondRun = handler?.(
        { toolName: "write", isError: false },
        ctx,
      ) as Promise<void>;
      await flushAsync();

      firstSync.resolve({
        stdout: "CodeGraph sync completed.",
        stderr: "",
        code: 0,
      });
      await waitFor(
        () =>
          (pi.exec as unknown as ReturnType<typeof vi.fn>).mock.calls.length ===
          2,
      );

      secondSync.resolve({
        stdout: "CodeGraph sync completed.",
        stderr: "",
        code: 0,
      });
      await Promise.all([firstRun, secondRun]);
      expect(pi.exec).toHaveBeenCalledTimes(2);
    });
  });

  it("agenda outro sync quando edit/write ocorre durante sync de início de turno", async () => {
    await withCodegraphDir(async (cwd) => {
      const firstSync = createDeferred<{
        stdout: string;
        stderr: string;
        code: number;
      }>();
      const secondSync = createDeferred<{
        stdout: string;
        stderr: string;
        code: number;
      }>();
      const { pi, eventHandlers } = createMockPi(
        vi
          .fn()
          .mockImplementationOnce(() => firstSync.promise)
          .mockImplementationOnce(() => secondSync.promise),
      );
      const mod = await import("../index.js");
      mod.default(pi);

      const beforeAgentStart = (eventHandlers.get("before_agent_start") ??
        [])[0];
      const toolResult = (eventHandlers.get("tool_result") ?? [])[0];
      const ctx = createMockCtx(cwd);
      const turnStartRun = beforeAgentStart?.({}, ctx) as Promise<void>;
      await waitFor(
        () =>
          (pi.exec as unknown as ReturnType<typeof vi.fn>).mock.calls.length ===
          1,
      );

      const fileMutationRun = toolResult?.(
        { toolName: "edit", isError: false },
        ctx,
      ) as Promise<void>;
      await flushAsync();

      firstSync.resolve({
        stdout: "CodeGraph sync completed.",
        stderr: "",
        code: 0,
      });
      await waitFor(
        () =>
          (pi.exec as unknown as ReturnType<typeof vi.fn>).mock.calls.length ===
          2,
      );

      secondSync.resolve({
        stdout: "CodeGraph sync completed.",
        stderr: "",
        code: 0,
      });
      await Promise.all([turnStartRun, fileMutationRun]);
      expect(pi.exec).toHaveBeenCalledTimes(2);
    });
  });

  it("ignora mudanças de filesystem em diretórios ruidosos", () => {
    expect(shouldIgnoreFileChange(".codegraph/index.db")).toBe(true);
    expect(shouldIgnoreFileChange(".git/index")).toBe(true);
    expect(shouldIgnoreFileChange("node_modules/pkg/index.js")).toBe(true);
    expect(shouldIgnoreFileChange("dist/index.js")).toBe(true);
    expect(shouldIgnoreFileChange("coverage/report.json")).toBe(true);
    expect(shouldIgnoreFileChange("src/index.ts")).toBe(false);
    expect(shouldIgnoreFileChange(null)).toBe(false);
  });

  it("sincroniza após save no filesystem enquanto sessão está aberta", async () => {
    await withCodegraphDir(async (cwd) => {
      const { pi, eventHandlers } = createMockPi();
      const mod = await import("../index.js");
      mod.default(pi);

      const sessionStart = (eventHandlers.get("session_start") ?? [])[0];
      const sessionShutdown = (eventHandlers.get("session_shutdown") ?? [])[0];
      const ctx = createMockCtx(cwd);

      await sessionStart?.({}, ctx);
      await writeFile(
        join(cwd, "changed.ts"),
        "export const changed = true;\n",
      );

      try {
        await waitForEventually(
          () =>
            (pi.exec as unknown as ReturnType<typeof vi.fn>).mock.calls
              .length === 1,
        );
        expect(pi.exec).toHaveBeenCalledWith(
          process.execPath,
          expect.arrayContaining(["sync", cwd, "--quiet"]),
          expect.objectContaining({ timeout: 30000 }),
        );
      } finally {
        await sessionShutdown?.({}, ctx);
      }
    });
  });

  it("não sincroniza após ferramenta sem mutação ou erro", async () => {
    await withCodegraphDir(async (cwd) => {
      const { pi, eventHandlers } = createMockPi();
      const mod = await import("../index.js");
      mod.default(pi);

      const handler = (eventHandlers.get("tool_result") ?? [])[0];
      const ctx = createMockCtx(cwd);
      await handler?.({ toolName: "read", isError: false }, ctx);
      await handler?.({ toolName: "write", isError: true }, ctx);

      expect(pi.exec).not.toHaveBeenCalled();
    });
  });
});
