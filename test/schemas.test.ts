import { describe, expect, it } from "vitest";
import {
  buildAffectedArgs,
  buildContextArgs,
  buildFilesArgs,
  buildIndexArgs,
  buildInitArgs,
  buildSearchArgs,
  buildStatusArgs,
  buildSyncArgs,
  CodegraphAffectedParams,
  CodegraphContextParams,
  CodegraphFilesParams,
  CodegraphIndexParams,
  CodegraphInitParams,
  CodegraphSearchParams,
  CodegraphStatusParams,
  CodegraphSyncParams,
} from "../src/schemas.js";

// ---------------------------------------------------------------------------
// Validação de schemas: todo schema deve ser um TObject válido
// ---------------------------------------------------------------------------

describe("schemas typebox", () => {
  const schemas = [
    { name: "CodegraphStatusParams", schema: CodegraphStatusParams },
    { name: "CodegraphInitParams", schema: CodegraphInitParams },
    { name: "CodegraphIndexParams", schema: CodegraphIndexParams },
    { name: "CodegraphSyncParams", schema: CodegraphSyncParams },
    { name: "CodegraphSearchParams", schema: CodegraphSearchParams },
    { name: "CodegraphFilesParams", schema: CodegraphFilesParams },
    { name: "CodegraphContextParams", schema: CodegraphContextParams },
    { name: "CodegraphAffectedParams", schema: CodegraphAffectedParams },
  ];

  for (const { name, schema } of schemas) {
    it(`${name} é um TObject`, () => {
      expect(schema).toBeDefined();
      expect(typeof schema).toBe("object");
    });
  }
});

// ---------------------------------------------------------------------------
// buildStatusArgs
// ---------------------------------------------------------------------------

describe("buildStatusArgs", () => {
  it("retorna ['status'] sem path", () => {
    expect(buildStatusArgs({})).toEqual(["status"]);
  });

  it("inclui path quando fornecido", () => {
    expect(buildStatusArgs({ path: "/tmp/proj" })).toEqual([
      "status",
      "/tmp/proj",
    ]);
  });

  it("omite path vazio", () => {
    expect(buildStatusArgs({ path: "" })).toEqual(["status"]);
  });
});

// ---------------------------------------------------------------------------
// buildInitArgs
// ---------------------------------------------------------------------------

describe("buildInitArgs", () => {
  it("retorna ['init'] sem argumentos", () => {
    expect(buildInitArgs({})).toEqual(["init"]);
  });

  it("adiciona --index quando true", () => {
    expect(buildInitArgs({ index: true })).toEqual(["init", "--index"]);
  });

  it("não adiciona --index quando false", () => {
    expect(buildInitArgs({ index: false })).toEqual(["init"]);
  });

  it("inclui path", () => {
    expect(buildInitArgs({ path: "./myproj", index: true })).toEqual([
      "init",
      "./myproj",
      "--index",
    ]);
  });
});

// ---------------------------------------------------------------------------
// buildIndexArgs
// ---------------------------------------------------------------------------

describe("buildIndexArgs", () => {
  it("retorna ['index'] sem flags", () => {
    expect(buildIndexArgs({})).toEqual(["index"]);
  });

  it("adiciona --force e --quiet", () => {
    expect(buildIndexArgs({ force: true, quiet: true })).toEqual([
      "index",
      "--force",
      "--quiet",
    ]);
  });

  it("não adiciona flags quando false", () => {
    expect(buildIndexArgs({ force: false, quiet: false })).toEqual(["index"]);
  });
});

// ---------------------------------------------------------------------------
// buildSyncArgs
// ---------------------------------------------------------------------------

describe("buildSyncArgs", () => {
  it("retorna ['sync'] sem flags", () => {
    expect(buildSyncArgs({})).toEqual(["sync"]);
  });

  it("adiciona --quiet e path", () => {
    expect(buildSyncArgs({ quiet: true, path: "/app" })).toEqual([
      "sync",
      "/app",
      "--quiet",
    ]);
  });
});

// ---------------------------------------------------------------------------
// buildSearchArgs
// ---------------------------------------------------------------------------

describe("buildSearchArgs", () => {
  it("monta comando básico com query e --json", () => {
    expect(buildSearchArgs({ query: "myFunc" })).toEqual([
      "query",
      "myFunc",
      "--json",
    ]);
  });

  it("adiciona --kind e --limit", () => {
    const args = buildSearchArgs({
      query: "handle",
      kind: "function",
      limit: 10,
    });
    expect(args).toEqual([
      "query",
      "handle",
      "--kind",
      "function",
      "--limit",
      "10",
      "--json",
    ]);
  });

  it("omite kind e limit quando undefined", () => {
    expect(buildSearchArgs({ query: "foo" })).toEqual([
      "query",
      "foo",
      "--json",
    ]);
  });

  it("inclui path após --json", () => {
    expect(buildSearchArgs({ query: "bar", path: "/src" })).toEqual([
      "query",
      "bar",
      "--json",
      "--path",
      "/src",
    ]);
  });

  it("sempre termina com --json (antes do path opcional)", () => {
    const args = buildSearchArgs({
      query: "x",
      kind: "class",
      limit: 5,
      path: "/p",
    });
    // --json deve vir antes de --path
    expect(args).toContain("--json");
    const jsonIdx = args.indexOf("--json");
    const pathIdx = args.indexOf("--path");
    expect(jsonIdx).toBeLessThan(pathIdx);
  });
});

// ---------------------------------------------------------------------------
// buildFilesArgs
// ---------------------------------------------------------------------------

describe("buildFilesArgs", () => {
  it("retorna ['files', '--json'] sem filtros", () => {
    expect(buildFilesArgs({})).toEqual(["files", "--json"]);
  });

  it("adiciona --format, --filter, --max-depth", () => {
    const args = buildFilesArgs({
      format: "json",
      filter: "src/**",
      maxDepth: 3,
    });
    expect(args).toEqual([
      "files",
      "--format",
      "json",
      "--filter",
      "src/**",
      "--max-depth",
      "3",
      "--json",
    ]);
  });

  it("inclui path como --path flag", () => {
    expect(buildFilesArgs({ path: "./lib" })).toEqual([
      "files",
      "--path",
      "./lib",
      "--json",
    ]);
  });

  it("omite flags undefined", () => {
    expect(buildFilesArgs({ format: undefined, filter: undefined })).toEqual([
      "files",
      "--json",
    ]);
  });
});

// ---------------------------------------------------------------------------
// buildContextArgs
// ---------------------------------------------------------------------------

describe("buildContextArgs", () => {
  it("retorna ['context', task] sem flags", () => {
    expect(buildContextArgs({ task: "fix login" })).toEqual([
      "context",
      "fix login",
    ]);
  });

  it("adiciona --format e --max-nodes", () => {
    const args = buildContextArgs({
      task: "explain auth",
      format: "markdown",
      maxNodes: 20,
    });
    expect(args).toEqual([
      "context",
      "explain auth",
      "--format",
      "markdown",
      "--max-nodes",
      "20",
    ]);
  });

  it("inclui path como --path flag", () => {
    expect(buildContextArgs({ task: "t", path: "/p" })).toEqual([
      "context",
      "t",
      "--path",
      "/p",
    ]);
  });
});

// ---------------------------------------------------------------------------
// buildAffectedArgs
// ---------------------------------------------------------------------------

describe("buildAffectedArgs", () => {
  it("retorna ['affected'] sem argumentos", () => {
    expect(buildAffectedArgs({})).toEqual(["affected"]);
  });

  it("adiciona files como argumentos posicionais", () => {
    const args = buildAffectedArgs({ files: ["src/a.ts", "src/b.ts"] });
    expect(args).toEqual(["affected", "src/a.ts", "src/b.ts"]);
  });

  it("adiciona --stdin quando stdin é fornecido (sem files)", () => {
    expect(buildAffectedArgs({ stdin: "a.ts\nb.ts" })).toEqual([
      "affected",
      "--stdin",
    ]);
  });

  it("prefere files sobre stdin", () => {
    const args = buildAffectedArgs({ files: ["a.ts"], stdin: "b.ts" });
    expect(args).toEqual(["affected", "a.ts"]);
    expect(args).not.toContain("--stdin");
  });

  it("adiciona --depth, --filter, --json, --quiet", () => {
    const args = buildAffectedArgs({
      depth: 3,
      filter: "e2e/*",
      json: true,
      quiet: true,
    });
    expect(args).toContain("--depth");
    expect(args).toContain("3");
    expect(args).toContain("--filter");
    expect(args).toContain("e2e/*");
    expect(args).toContain("--json");
    expect(args).toContain("--quiet");
  });

  it("não adiciona flags booleanas quando false", () => {
    const args = buildAffectedArgs({ json: false, quiet: false });
    expect(args).not.toContain("--json");
    expect(args).not.toContain("--quiet");
  });

  it("omite flags undefined", () => {
    const args = buildAffectedArgs({ depth: undefined, filter: undefined });
    expect(args).not.toContain("--depth");
    expect(args).not.toContain("--filter");
  });
});

// ---------------------------------------------------------------------------
// Regras de segurança: nenhum builder retorna string
// ---------------------------------------------------------------------------

describe("builders retornam sempre string[]", () => {
  const builders = [
    { name: "buildStatusArgs", fn: () => buildStatusArgs({}) },
    { name: "buildInitArgs", fn: () => buildInitArgs({}) },
    { name: "buildIndexArgs", fn: () => buildIndexArgs({}) },
    { name: "buildSyncArgs", fn: () => buildSyncArgs({}) },
    { name: "buildSearchArgs", fn: () => buildSearchArgs({ query: "test" }) },
    { name: "buildFilesArgs", fn: () => buildFilesArgs({}) },
    { name: "buildContextArgs", fn: () => buildContextArgs({ task: "test" }) },
    { name: "buildAffectedArgs", fn: () => buildAffectedArgs({}) },
  ];

  for (const { name, fn } of builders) {
    it(`${name} retorna array`, () => {
      const result = fn();
      expect(Array.isArray(result)).toBe(true);
      expect(typeof result).not.toBe("string");
    });

    it(`${name} — todos os elementos são strings`, () => {
      const result = fn();
      for (const el of result) {
        expect(typeof el).toBe("string");
      }
    });
  }
});
