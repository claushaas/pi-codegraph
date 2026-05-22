import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// summarizeSearchResults (internal helper do codegraph_search)
// ---------------------------------------------------------------------------

// Reimplementação mínima da função privada para teste.
// A função original está em src/tools/search.ts e não é exportada.
// Testamos o comportamento através do execute da ferramenta.

// ---------------------------------------------------------------------------
// execCodegraph / firstLine (internal helpers do commands.ts)
// ---------------------------------------------------------------------------

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Importa hasCodegraph do módulo de guidance
import { hasCodegraph } from "../src/guidance.js";

describe("helpers internos (integração)", () => {
  it("hasCodegraph retorna false para diretório vazio", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-codegraph-helper-"));
    try {
      expect(await hasCodegraph(tmp)).toBe(false);
    } finally {
      await rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("hasCodegraph retorna true quando .codegraph/ é criado", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "pi-codegraph-helper-"));
    try {
      const { mkdir } = await import("node:fs/promises");
      await mkdir(join(tmp, ".codegraph"));
      expect(await hasCodegraph(tmp)).toBe(true);
    } finally {
      await rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
  });
});
