import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockPiTools {
  pi: ExtensionAPI;
  registeredTools: Map<string, Record<string, unknown>>;
  execCalls: Array<{
    cmd: string;
    args: string[];
    opts?: Record<string, unknown>;
  }>;
  setExecResult: (stdout: string, stderr?: string, code?: number) => void;
  setExecError: (stderr: string, code?: number) => void;
}

/** Cria um mock de ExtensionAPI que captura registerTool e exec. */
function createMockPi(): MockPiTools {
  const registeredTools = new Map<string, Record<string, unknown>>();
  const execCalls: Array<{
    cmd: string;
    args: string[];
    opts?: Record<string, unknown>;
  }> = [];
  let execResult = { stdout: "ok", stderr: "", code: 0 };

  const pi = {
    exec: vi.fn(
      async (
        _cmd: string,
        _args: string[],
        _opts?: Record<string, unknown>,
      ) => {
        execCalls.push({ cmd: _cmd, args: _args, opts: _opts });
        return { ...execResult };
      },
    ),
    registerTool: vi.fn((def: Record<string, unknown>) => {
      registeredTools.set(def.name as string, def);
    }),
    on: vi.fn(),
    registerCommand: vi.fn(),
  } as unknown as ExtensionAPI;

  return {
    pi,
    registeredTools,
    execCalls,
    setExecResult(stdout: string, stderr = "", code = 0) {
      execResult = { stdout, stderr, code };
    },
    setExecError(stderr: string, code = 1) {
      execResult = { stdout: "", stderr, code };
    },
  };
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
      expect(
        registeredTools.has(name),
        `ferramenta ${name} não registrada`,
      ).toBe(true);
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
      expect(typeof def.promptSnippet, `${name}: promptSnippet ausente`).toBe(
        "string",
      );
      expect(
        Array.isArray(def.promptGuidelines),
        `${name}: promptGuidelines não é array`,
      ).toBe(true);
      expect(
        (def.promptGuidelines as string[]).length,
        `${name}: promptGuidelines vazio`,
      ).toBeGreaterThan(0);
    }
  });

  it("reforça CodeGraph como preferência antes de exploração manual", async () => {
    const { pi, registeredTools } = createMockPi();
    const mod = await import("../index.js");
    mod.default(pi);

    expect(
      (
        registeredTools.get("codegraph_search")?.promptGuidelines as string[]
      ).join("\n"),
    ).toContain("before grep/find/read");
    expect(
      (
        registeredTools.get("codegraph_context")?.promptGuidelines as string[]
      ).join("\n"),
    ).toContain("reading multiple files manually");
    expect(
      (
        registeredTools.get("codegraph_files")?.promptGuidelines as string[]
      ).join("\n"),
    ).toContain("before ls/find/tree");
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
    const result = await (tool.execute as Function)(
      "id",
      {},
      new AbortController().signal,
      undefined,
      ctx,
    );

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
    const result = await (tool.execute as Function)(
      "id",
      {},
      new AbortController().signal,
      undefined,
      ctx,
    );

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
    const result = await (tool.execute as Function)(
      "id",
      {},
      new AbortController().signal,
      undefined,
      ctx,
    );

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
    const result = await (tool.execute as Function)(
      "id",
      {},
      new AbortController().signal,
      undefined,
      ctx,
    );

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
      (tool.execute as Function)(
        "id",
        {},
        new AbortController().signal,
        undefined,
        ctx,
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("codegraph_search resume JSON em texto legível", async () => {
    const mock = createMockPi();
    const json = [
      { name: "handleAuth", kind: "function", file: "src/auth.ts", line: 42 },
      { name: "AuthService", kind: "class", file: "src/auth.ts", line: 15 },
    ];
    mock.setExecResult(JSON.stringify(json));

    const mod = await import("../index.js");
    mod.default(mock.pi);

    const tool = mock.registeredTools.get("codegraph_search")!;
    const ctx = { cwd: "/tmp/proj" };
    const result = await (tool.execute as Function)(
      "id",
      { query: "auth" },
      new AbortController().signal,
      undefined,
      ctx,
    );

    expect(result.content[0].text).toContain("Encontrados 2");
    expect(result.content[0].text).toContain("handleAuth");
    expect(result.content[0].text).toContain("AuthService");
    expect(result.details.raw).toEqual(json);
  });

  it("codegraph_search resume o formato node retornado pela CLI atual", async () => {
    const mock = createMockPi();
    const json = [
      {
        node: {
          kind: "function",
          name: "renderCoreResult",
          qualifiedName: "renderCoreResult",
          filePath: "src/core/render.ts",
          startLine: 27,
        },
        score: 98.4,
      },
    ];
    mock.setExecResult(JSON.stringify(json));

    const mod = await import("../index.js");
    mod.default(mock.pi);

    const tool = mock.registeredTools.get("codegraph_search")!;
    const ctx = { cwd: "/tmp/proj" };
    const result = await (tool.execute as Function)(
      "id",
      { query: "renderCoreResult" },
      new AbortController().signal,
      undefined,
      ctx,
    );

    expect(result.content[0].text).toContain("renderCoreResult [function]");
    expect(result.content[0].text).toContain("src/core/render.ts:27");
    expect(result.content[0].text).not.toContain("(sem nome)");
  });

  it("codegraph_search retorna mensagem quando array vazio", async () => {
    const mock = createMockPi();
    mock.setExecResult("[]");

    const mod = await import("../index.js");
    mod.default(mock.pi);

    const tool = mock.registeredTools.get("codegraph_search")!;
    const ctx = { cwd: "/tmp/proj" };
    const result = await (tool.execute as Function)(
      "id",
      { query: "nonexistent" },
      new AbortController().signal,
      undefined,
      ctx,
    );

    expect(result.content[0].text).toContain("Nenhum");
  });

  it("codegraph_affected stdin mode usa bash", async () => {
    const mock = createMockPi();
    mock.setExecResult("test/auth.test.ts");

    const mod = await import("../index.js");
    mod.default(mock.pi);

    const tool = mock.registeredTools.get("codegraph_affected")!;
    const ctx = { cwd: "/tmp/proj" };
    const result = await (tool.execute as Function)(
      "id",
      { stdin: "src/auth.ts\nsrc/utils.ts" },
      new AbortController().signal,
      undefined,
      ctx,
    );

    expect(result).toHaveProperty("content");
    expect(result.details.stdinMode).toBe(true);
    expect(mock.execCalls.at(-1)?.cmd).toBe("bash");
    expect(mock.execCalls.at(-1)?.args[1] as string).toContain(
      "@colbymchenry/codegraph",
    );
    expect(mock.execCalls.at(-1)?.args[1] as string).toContain("affected");
  });

  it("codegraph_files parseia JSON e formata saída", async () => {
    const mock = createMockPi();
    mock.setExecResult(
      JSON.stringify({ files: ["src/a.ts", "src/b.ts"], directories: ["src"] }),
    );

    const mod = await import("../index.js");
    mod.default(mock.pi);

    const tool = mock.registeredTools.get("codegraph_files")!;
    const ctx = { cwd: "/tmp/proj" };
    const result = await (tool.execute as Function)(
      "id",
      {},
      new AbortController().signal,
      undefined,
      ctx,
    );

    expect(result.details.raw).toBeDefined();
  });

  it("codegraph_init falha com erro claro", async () => {
    const mock = createMockPi();
    mock.setExecError("permission denied", 1);

    const mod = await import("../index.js");
    mod.default(mock.pi);

    const tool = mock.registeredTools.get("codegraph_init")!;
    const ctx = { cwd: "/tmp/proj" };

    await expect(
      (tool.execute as Function)(
        "id",
        {},
        new AbortController().signal,
        undefined,
        ctx,
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("codegraph_context inclui metadados de truncamento", async () => {
    const mock = createMockPi();
    // Output pequeno — não trunca
    mock.setExecResult("function handle() {}\n");

    const mod = await import("../index.js");
    mod.default(mock.pi);

    const tool = mock.registeredTools.get("codegraph_context")!;
    const ctx = { cwd: "/tmp/proj" };
    const result = await (tool.execute as Function)(
      "id",
      { task: "explain" },
      new AbortController().signal,
      undefined,
      ctx,
    );

    expect(result.details.truncated).toBe(false);
    expect(result.details.task).toBe("explain");
  });

  it("codegraph_context trunca output grande", async () => {
    const mock = createMockPi();
    // Gera output acima de 2000 linhas
    const lines = Array.from({ length: 2500 }, (_, i) => `linha ${i}`);
    mock.setExecResult(lines.join("\n"));

    const mod = await import("../index.js");
    mod.default(mock.pi);

    const tool = mock.registeredTools.get("codegraph_context")!;
    const ctx = { cwd: "/tmp/proj" };
    const result = await (tool.execute as Function)(
      "id",
      { task: "big" },
      new AbortController().signal,
      undefined,
      ctx,
    );

    expect(result.details.truncated).toBe(true);
    expect(result.content[0].text).toContain("Saída truncada");
  });
});
