import { describe, it, expect, vi } from "vitest";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockUi {
  notify: ReturnType<typeof vi.fn>;
  confirm: ReturnType<typeof vi.fn>;
  setStatus: ReturnType<typeof vi.fn>;
}

function createMockCtx(overrides: Partial<{ hasUI: boolean; cwd: string; ui: MockUi }> = {}): ExtensionCommandContext {
  const ui: MockUi = overrides.ui ?? {
    notify: vi.fn(),
    confirm: vi.fn().mockResolvedValue(true),
    setStatus: vi.fn(),
  };

  return {
    hasUI: overrides.hasUI ?? true,
    cwd: overrides.cwd ?? "/tmp/test-project",
    ui: ui as unknown as ExtensionCommandContext["ui"],
    sessionManager: {} as unknown as ExtensionCommandContext["sessionManager"],
    signal: undefined,
    modelRegistry: {} as unknown as ExtensionCommandContext["modelRegistry"],
    model: undefined,
    getSystemPrompt: vi.fn(() => ""),
    getContextUsage: vi.fn(() => null),
    isIdle: vi.fn(() => true),
    abort: vi.fn(),
    hasPendingMessages: vi.fn(() => false),
    shutdown: vi.fn(),
    compact: vi.fn(),
    waitForIdle: vi.fn(),
    reload: vi.fn(),
    newSession: vi.fn(),
    fork: vi.fn(),
    navigateTree: vi.fn(),
    switchSession: vi.fn(),
  } as unknown as ExtensionCommandContext;
}

interface MockPi {
  pi: ExtensionAPI;
  execCalls: Array<{ cmd: string; args: string[]; opts?: Record<string, unknown> }>;
  registeredCommands: Map<string, { description: string; handler: Function }>;
}

function createMockPi(): MockPi {
  const execCalls: Array<{ cmd: string; args: string[]; opts?: Record<string, unknown> }> = [];
  const registeredCommands = new Map<string, { description: string; handler: Function }>();
  const eventHandlers = new Map<string, Function[]>();

  const pi = {
    exec: vi.fn(async (_cmd: string, _args: string[], _opts?: Record<string, unknown>) => {
      execCalls.push({ cmd: _cmd, args: _args, opts: _opts });
      return { stdout: "CodeGraph v0.7.10\n1 language, 42 nodes, 84 edges", stderr: "", code: 0 };
    }),
    sendMessage: vi.fn(),
    registerTool: vi.fn(),
    registerCommand: vi.fn((name: string, def: { description: string; handler: Function }) => {
      registeredCommands.set(name, def);
    }),
    on: vi.fn((event: string, handler: Function) => {
      if (!eventHandlers.has(event)) eventHandlers.set(event, []);
      eventHandlers.get(event)!.push(handler);
    }),
  } as unknown as ExtensionAPI;

  return { pi, execCalls, registeredCommands };
}

// ---------------------------------------------------------------------------
// Registro de comandos
// ---------------------------------------------------------------------------

describe("registro de comandos slash", () => {
  it("registra /codegraph-status, /codegraph-init, /codegraph-index, /codegraph-sync", async () => {
    const { pi, registeredCommands } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    expect(registeredCommands.has("codegraph-status")).toBe(true);
    expect(registeredCommands.has("codegraph-init")).toBe(true);
    expect(registeredCommands.has("codegraph-index")).toBe(true);
    expect(registeredCommands.has("codegraph-sync")).toBe(true);
  });

  it("cada comando tem description e handler", async () => {
    const { pi, registeredCommands } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    for (const [name, def] of registeredCommands) {
      expect(typeof def.description).toBe("string");
      expect(typeof def.handler).toBe("function");
    }
  });
});

// ---------------------------------------------------------------------------
// /codegraph-status
// ---------------------------------------------------------------------------

describe("/codegraph-status", () => {
  it("executa codegraph status no ctx.cwd", async () => {
    const { pi, registeredCommands } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    const cmd = registeredCommands.get("codegraph-status")!;
    const ctx = createMockCtx({ cwd: "/my/project" });
    await cmd.handler("", ctx);

    const statusCall = (pi.exec as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c as string[])[1]?.[0] === "status",
    );
    expect(statusCall).toBeDefined();
    if (statusCall) {
      expect(statusCall[1]).toContain("/my/project");
    }
  });

  it("notifica com resultado em modo UI", async () => {
    const { pi, registeredCommands } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    const ui = { notify: vi.fn(), confirm: vi.fn(), setStatus: vi.fn() };
    const ctx = createMockCtx({ ui });
    const cmd = registeredCommands.get("codegraph-status")!;
    await cmd.handler("", ctx);

    expect(ui.notify).toHaveBeenCalled();
  });

  it("exibe resultado persistente no histórico", async () => {
    const { pi, registeredCommands } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    const ctx = createMockCtx({ cwd: "/my/project" });
    const cmd = registeredCommands.get("codegraph-status")!;
    await cmd.handler("", ctx);

    expect(pi.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      customType: "codegraph-status",
      content: expect.stringContaining("CodeGraph v0.7.10"),
      display: true,
      details: expect.objectContaining({ cwd: "/my/project", level: "info" }),
    }));
  });

  it("notifica warning quando CodeGraph não inicializado", async () => {
    const { pi, registeredCommands } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    // Mock exec para falhar com "not initialized"
    (pi.exec as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      stdout: "",
      stderr: "project not initialized",
      code: 1,
    });

    const ui = { notify: vi.fn(), confirm: vi.fn(), setStatus: vi.fn() };
    const ctx = createMockCtx({ ui });
    const cmd = registeredCommands.get("codegraph-status")!;
    await cmd.handler("", ctx);

    const calls = (ui.notify as ReturnType<typeof vi.fn>).mock.calls;
    const warningCall = calls.find((c: unknown[]) => (c[0] as string).includes("not initialized"));
    expect(warningCall).toBeDefined();
    expect(pi.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      customType: "codegraph-status",
      content: expect.stringContaining("not initialized"),
      display: true,
      details: expect.objectContaining({ level: "warning" }),
    }));
  });
});

// ---------------------------------------------------------------------------
// /codegraph-init
// ---------------------------------------------------------------------------

describe("/codegraph-init", () => {
  it("confirma antes de executar", async () => {
    const { pi, registeredCommands } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    const ui = { notify: vi.fn(), confirm: vi.fn().mockResolvedValue(true), setStatus: vi.fn() };
    const ctx = createMockCtx({ ui });
    const cmd = registeredCommands.get("codegraph-init")!;
    await cmd.handler("", ctx);

    expect(ui.confirm).toHaveBeenCalled();
  });

  it("não executa se usuário cancelar", async () => {
    const { pi, registeredCommands } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    const ui = { notify: vi.fn(), confirm: vi.fn().mockResolvedValue(false), setStatus: vi.fn() };
    const ctx = createMockCtx({ ui });
    const cmd = registeredCommands.get("codegraph-init")!;
    await cmd.handler("", ctx);

    // confirm foi chamado, mas exec não (porque cancelou)
    expect(ui.confirm).toHaveBeenCalled();
    const initCall = (pi.exec as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c as string[])[1]?.[0] === "init",
    );
    expect(initCall).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// /codegraph-index
// ---------------------------------------------------------------------------

describe("/codegraph-index", () => {
  it("confirma antes de indexar", async () => {
    const { pi, registeredCommands } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    // Cria um dir temporário com .codegraph/ para que hasCodegraph retorne true
    const { mkdtemp, rm, mkdir } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const tmp = await mkdtemp(join(tmpdir(), "pi-codegraph-cmd-"));
    await mkdir(join(tmp, ".codegraph"));

    try {
      const ui = { notify: vi.fn(), confirm: vi.fn().mockResolvedValue(true), setStatus: vi.fn() };
      const ctx = createMockCtx({ ui, cwd: tmp });
      const cmd = registeredCommands.get("codegraph-index")!;
      await cmd.handler("", ctx);

      expect(ui.confirm).toHaveBeenCalled();
    } finally {
      await rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("avisa se .codegraph/ não existe", async () => {
    const { pi, registeredCommands } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    const ui = { notify: vi.fn(), confirm: vi.fn(), setStatus: vi.fn() };
    // CWD que não tem .codegraph/
    const ctx = createMockCtx({ ui, cwd: "/tmp/nonexistent-project-xyz" });
    const cmd = registeredCommands.get("codegraph-index")!;
    await cmd.handler("", ctx);

    const calls = (ui.notify as ReturnType<typeof vi.fn>).mock.calls;
    const warningCall = calls.find((c: unknown[]) =>
      (c[0] as string).includes("not initialized"),
    );
    expect(warningCall).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// /codegraph-sync
// ---------------------------------------------------------------------------

describe("/codegraph-sync", () => {
  it("executa codegraph sync no ctx.cwd", async () => {
    const { pi, registeredCommands } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    const { mkdtemp, rm, mkdir } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const tmp = await mkdtemp(join(tmpdir(), "pi-codegraph-sync-cmd-"));
    await mkdir(join(tmp, ".codegraph"));

    try {
      const ctx = createMockCtx({ cwd: tmp });
      const cmd = registeredCommands.get("codegraph-sync")!;
      await cmd.handler("", ctx);

      const syncCall = (pi.exec as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c as string[])[1]?.[0] === "sync",
      );
      expect(syncCall).toBeDefined();
      if (syncCall) {
        expect(syncCall[1]).toContain(tmp);
        expect(syncCall[1]).toContain("--quiet");
      }
    } finally {
      await rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("avisa se .codegraph/ não existe", async () => {
    const { pi, registeredCommands } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    const ctx = createMockCtx({ cwd: "/tmp/nonexistent-project-sync-xyz" });
    const cmd = registeredCommands.get("codegraph-sync")!;
    await cmd.handler("", ctx);

    expect(pi.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      customType: "codegraph-sync",
      content: expect.stringContaining("not initialized"),
      display: true,
      details: expect.objectContaining({ command: "sync", level: "warning" }),
    }));
  });
});

// ---------------------------------------------------------------------------
// Modo sem UI
// ---------------------------------------------------------------------------

describe("comandos em modo sem UI", () => {
  it("/codegraph-status não quebra quando hasUI é false", async () => {
    const { pi, registeredCommands } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    const ctx = createMockCtx({ hasUI: false });
    const cmd = registeredCommands.get("codegraph-status")!;
    // Não deve lançar
    await expect(cmd.handler("", ctx)).resolves.toBeUndefined();
  });

  it("/codegraph-init mostra mensagem informativa sem UI", async () => {
    const { pi, registeredCommands } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    const ctx = createMockCtx({ hasUI: false });
    const cmd = registeredCommands.get("codegraph-init")!;
    await expect(cmd.handler("", ctx)).resolves.toBeUndefined();
  });
});
