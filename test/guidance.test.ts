import { describe, it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hasCodegraph, CODEGRAPH_READY_GUIDANCE, CODEGRAPH_MISSING_GUIDANCE } from "../src/guidance.js";

// ---------------------------------------------------------------------------
// hasCodegraph
// ---------------------------------------------------------------------------

describe("hasCodegraph", () => {
  it("retorna false quando .codegraph/ não existe", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-codegraph-test-"));
    try {
      const result = await hasCodegraph(tmp);
      expect(result).toBe(false);
    } finally {
      await rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("retorna true quando .codegraph/ existe (diretório)", async () => {
    // Usa o próprio diretório do projeto que já tem node_modules (um dir)
    // mas não .codegraph/. Criamos .codegraph/ temporariamente.
    const tmp = await mkdtemp(join(tmpdir(), "pi-codegraph-test-"));
    try {
      // Cria o diretório .codegraph/
      const { mkdir } = await import("node:fs/promises");
      await mkdir(join(tmp, ".codegraph"));
      const result = await hasCodegraph(tmp);
      expect(result).toBe(true);
    } finally {
      await rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
  });
});

// ---------------------------------------------------------------------------
// Textos de orientação
// ---------------------------------------------------------------------------

describe("CODEGRAPH_READY_GUIDANCE", () => {
  it("menciona as ferramentas codegraph_*", () => {
    expect(CODEGRAPH_READY_GUIDANCE).toContain("codegraph_search");
    expect(CODEGRAPH_READY_GUIDANCE).toContain("codegraph_context");
    expect(CODEGRAPH_READY_GUIDANCE).toContain("codegraph_files");
    expect(CODEGRAPH_READY_GUIDANCE).toContain("codegraph_status");
    expect(CODEGRAPH_READY_GUIDANCE).toContain("codegraph_affected");
  });

  it("menciona preferir CodeGraph sobre grep/find", () => {
    expect(CODEGRAPH_READY_GUIDANCE).toMatch(/prefer.*grep/i);
  });

  it("menciona usar read depois do CodeGraph", () => {
    expect(CODEGRAPH_READY_GUIDANCE).toContain("read");
  });

  it("menciona não usar sub-agentes para exploração", () => {
    expect(CODEGRAPH_READY_GUIDANCE).toMatch(/sub.agent/i);
  });

  it("não menciona MCP", () => {
    expect(CODEGRAPH_READY_GUIDANCE).not.toMatch(/MCP/i);
  });

  it("menciona .codegraph/ no início", () => {
    expect(CODEGRAPH_READY_GUIDANCE).toContain(".codegraph/");
  });
});

describe("CODEGRAPH_MISSING_GUIDANCE", () => {
  it("menciona codegraph_init", () => {
    expect(CODEGRAPH_MISSING_GUIDANCE).toContain("codegraph_init");
  });

  it("menciona /codegraph-init", () => {
    expect(CODEGRAPH_MISSING_GUIDANCE).toContain("/codegraph-init");
  });

  it("menciona grep/find/ls", () => {
    expect(CODEGRAPH_MISSING_GUIDANCE).toMatch(/grep/i);
  });

  it("não menciona MCP", () => {
    expect(CODEGRAPH_MISSING_GUIDANCE).not.toMatch(/MCP/i);
  });
});
