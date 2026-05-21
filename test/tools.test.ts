import { describe, it, expect, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cria um mock de ExtensionAPI que captura registerTool e exec. */
function createMockPi(): {
  pi: ExtensionAPI;
  registeredTools: Map<string, Record<string, unknown>>;
  execCalls: Array<{ cmd: string; args: string[]; opts?: Record<string, unknown> }>;
} {
  const registeredTools = new Map<string, Record<string, unknown>>();
  const execCalls: Array<{ cmd: string; args: string[]; opts?: Record<string, unknown> }> = [];

  const pi = {
    exec: vi.fn(async (_cmd: string, _args: string[], _opts?: Record<string, unknown>) => ({
      stdout: "ok",
      stderr: "",
      code: 0,
    })),
    registerTool: vi.fn((def: Record<string, unknown>) => {
      registeredTools.set(def.name as string, def);
    }),
    on: vi.fn(),
    registerCommand: vi.fn(),
  } as unknown as ExtensionAPI;

  // Override exec to track calls
  (pi.exec as ReturnType<typeof vi.fn>).mockImplementation(
    async (cmd: string, args: string[], opts?: Record<string, unknown>) => {
      execCalls.push({ cmd, args, opts });
      return { stdout: "ok", stderr: "", code: 0 };
    },
  );

  return { pi, registeredTools, execCalls };
}

// ---------------------------------------------------------------------------
// Registro de ferramentas
// ---------------------------------------------------------------------------

describe("registro de ferramentas", () => {
  it("registra todas as 8 ferramentas codegraph_*", async () => {
    const { pi, registeredTools } = createMockPi();

    // Importação dinâmica para garantir que o módulo seja carregado após o mock
    const mod = await import("../index.js");
    mod.default(pi);

    const expectedTools = [
      "codegraph_status",
      "codegraph_search",
      "codegraph_files",
      "codegraph_context",
      "codegraph_init",
      "codegraph_index",
      "codegraph_sync",
      "codegraph_affected",
    ];

    for (const name of expectedTools) {
      expect(registeredTools.has(name), `ferramenta ${name} não registrada`).toBe(true);
    }

    expect(registeredTools.size).toBe(8);
  });

  it("cada ferramenta tem name, label, description, parameters, execute", async () => {
    const { pi, registeredTools } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    for (const [name, def] of registeredTools) {
      expect(def.name).toBe(name);
      expect(typeof def.label).toBe("string");
      expect(typeof def.description).toBe("string");
      expect(typeof def.parameters).toBe("object");
      expect(typeof def.execute).toBe("function");
    }
  });

  it("cada ferramenta tem promptSnippet e promptGuidelines", async () => {
    const { pi, registeredTools } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    for (const [name, def] of registeredTools) {
      expect(typeof def.promptSnippet, `${name}: promptSnippet ausente`).toBe("string");
      expect(Array.isArray(def.promptGuidelines), `${name}: promptGuidelines não é array`).toBe(true);
      expect((def.promptGuidelines as string[]).length, `${name}: promptGuidelines vazio`).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

describe("execução das ferramentas", () => {
  it("codegraph_status executa com buildStatusArgs", async () => {
    const { pi, registeredTools } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    const tool = registeredTools.get("codegraph_status")!;
    const ctx = { cwd: "/tmp/proj" };
    const result = await (tool.execute as Function)("id", {}, new AbortController().signal, undefined, ctx);

    expect(result).toHaveProperty("content");
    expect(result.content[0].type).toBe("text");
    expect(result).toHaveProperty("details");
  });

  it("codegraph_search executa com buildSearchArgs", async () => {
    const { pi, registeredTools } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    const tool = registeredTools.get("codegraph_search")!;
    const ctx = { cwd: "/tmp/proj" };
    const result = await (tool.execute as Function)(
      "id",
      { query: "myFunc" },
      new AbortController().signal,
      undefined,
      ctx,
    );

    expect(result).toHaveProperty("content");
    expect(result.content[0].type).toBe("text");
    expect(result).toHaveProperty("details");
  });

  it("codegraph_files executa com buildFilesArgs", async () => {
    const { pi, registeredTools } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    const tool = registeredTools.get("codegraph_files")!;
    const ctx = { cwd: "/tmp/proj" };
    const result = await (tool.execute as Function)("id", {}, new AbortController().signal, undefined, ctx);

    expect(result).toHaveProperty("content");
    expect(result.content[0].type).toBe("text");
  });

  it("codegraph_context executa com buildContextArgs", async () => {
    const { pi, registeredTools } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    const tool = registeredTools.get("codegraph_context")!;
    const ctx = { cwd: "/tmp/proj" };
    const result = await (tool.execute as Function)(
      "id",
      { task: "explain auth" },
      new AbortController().signal,
      undefined,
      ctx,
    );

    expect(result).toHaveProperty("content");
    expect(result.content[0].type).toBe("text");
  });

  it("codegraph_init executa com buildInitArgs", async () => {
    const { pi, registeredTools } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    const tool = registeredTools.get("codegraph_init")!;
    const ctx = { cwd: "/tmp/proj" };
    const result = await (tool.execute as Function)("id", {}, new AbortController().signal, undefined, ctx);

    expect(result).toHaveProperty("content");
  });

  it("codegraph_index executa com buildIndexArgs", async () => {
    const { pi, registeredTools } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    const tool = registeredTools.get("codegraph_index")!;
    const ctx = { cwd: "/tmp/proj" };
    const result = await (tool.execute as Function)(
      "id",
      { force: true },
      new AbortController().signal,
      undefined,
      ctx,
    );

    expect(result).toHaveProperty("content");
  });

  it("codegraph_sync executa com buildSyncArgs", async () => {
    const { pi, registeredTools } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    const tool = registeredTools.get("codegraph_sync")!;
    const ctx = { cwd: "/tmp/proj" };
    const result = await (tool.execute as Function)("id", {}, new AbortController().signal, undefined, ctx);

    expect(result).toHaveProperty("content");
  });

  it("codegraph_affected executa com buildAffectedArgs", async () => {
    const { pi, registeredTools } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    const tool = registeredTools.get("codegraph_affected")!;
    const ctx = { cwd: "/tmp/proj" };
    const result = await (tool.execute as Function)(
      "id",
      { files: ["src/a.ts"] },
      new AbortController().signal,
      undefined,
      ctx,
    );

    expect(result).toHaveProperty("content");
    expect(result.content[0].type).toBe("text");
  });
});

// ---------------------------------------------------------------------------
// Erro: CLI falha
// ---------------------------------------------------------------------------

describe("erro de CLI", () => {
  it("ferramenta lança erro quando codegraph retorna código != 0", async () => {
    const { pi, registeredTools } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    // Mock exec para retornar erro
    (pi.exec as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      stdout: "",
      stderr: "project not initialized",
      code: 1,
    });

    const tool = registeredTools.get("codegraph_status")!;
    const ctx = { cwd: "/tmp/proj" };

    await expect(
      (tool.execute as Function)("id", {}, new AbortController().signal, undefined, ctx),
    ).rejects.toThrow();
  });
});
