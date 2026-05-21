import { describe, it, expect, vi } from "vitest";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

function createMockPi() {
  const eventHandlers = new Map<string, Function[]>();
  const pi = {
    exec: vi.fn(async () => ({ stdout: "CodeGraph sync completed.", stderr: "", code: 0 })),
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
        "codegraph",
        ["sync", cwd, "--quiet"],
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
        "codegraph",
        ["sync", cwd, "--quiet"],
        expect.objectContaining({ timeout: 30000 }),
      );
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
