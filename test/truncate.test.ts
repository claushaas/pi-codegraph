import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
} from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import {
  formatToolOutput,
  TOOL_OUTPUT_MAX_BYTES_LABEL,
  TOOL_OUTPUT_MAX_LINES,
} from "../src/truncate.js";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

describe("constantes exportadas", () => {
  it("TOOL_OUTPUT_MAX_LINES igual ao DEFAULT_MAX_LINES do Pi", () => {
    expect(TOOL_OUTPUT_MAX_LINES).toBe(DEFAULT_MAX_LINES);
  });

  it("TOOL_OUTPUT_MAX_BYTES_LABEL é string não vazia", () => {
    expect(typeof TOOL_OUTPUT_MAX_BYTES_LABEL).toBe("string");
    expect(TOOL_OUTPUT_MAX_BYTES_LABEL.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Sem truncamento
// ---------------------------------------------------------------------------

describe("formatToolOutput — sem truncamento", () => {
  it("retorna o texto original quando está abaixo dos limites", () => {
    const output = "linha 1\nlinha 2\nlinha 3";
    const result = formatToolOutput(output);
    expect(result.text).toBe(output);
    expect(result.truncation.truncated).toBe(false);
  });

  it("string vazia não trunca", () => {
    const result = formatToolOutput("");
    expect(result.text).toBe("");
    expect(result.truncation.truncated).toBe(false);
  });

  it("output de uma linha não trunca", () => {
    const result = formatToolOutput("apenas uma linha");
    expect(result.text).toBe("apenas uma linha");
    expect(result.truncation.truncated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Truncamento por linhas (head)
// ---------------------------------------------------------------------------

describe("formatToolOutput — truncamento por linhas (head)", () => {
  it("trunca quando output excede DEFAULT_MAX_LINES", () => {
    const lines = Array.from(
      { length: DEFAULT_MAX_LINES + 100 },
      (_, i) => `linha ${i}`,
    );
    const output = lines.join("\n");

    const result = formatToolOutput(output, "head");

    expect(result.truncation.truncated).toBe(true);
    expect(result.truncation.outputLines!).toBeLessThanOrEqual(
      DEFAULT_MAX_LINES,
    );
    expect(result.truncation.totalLines!).toBe(DEFAULT_MAX_LINES + 100);
    // A mensagem deve mencionar truncamento
    expect(result.text).toContain("[Saída truncada");
  });

  it("mantém o início do texto (head)", () => {
    const lines = Array.from(
      { length: DEFAULT_MAX_LINES + 10 },
      (_, i) => `linha ${i}`,
    );
    const output = lines.join("\n");

    const result = formatToolOutput(output, "head");

    // As primeiras linhas devem estar presentes
    expect(result.text).toContain("linha 0");
    expect(result.text).toContain("linha 1");
    expect(result.text).toContain("linha 2");
  });
});

// ---------------------------------------------------------------------------
// Truncamento por bytes (head)
// ---------------------------------------------------------------------------

describe("formatToolOutput — truncamento por bytes (head)", () => {
  it("trunca quando output excede DEFAULT_MAX_BYTES", () => {
    // Gera ~60KB de texto (acima de 50KB)
    const chunk = `${"a".repeat(1000)}\n`;
    const output = chunk.repeat(65); // ~65KB

    const result = formatToolOutput(output, "head");

    expect(result.truncation.truncated).toBe(true);
    expect(result.truncation.outputBytes!).toBeLessThanOrEqual(
      DEFAULT_MAX_BYTES,
    );
    expect(result.truncation.totalBytes!).toBeGreaterThan(DEFAULT_MAX_BYTES);
  });
});

// ---------------------------------------------------------------------------
// Modo tail
// ---------------------------------------------------------------------------

describe("formatToolOutput — modo tail", () => {
  it("mantém o final do texto", () => {
    const lines = Array.from(
      { length: DEFAULT_MAX_LINES + 50 },
      (_, i) => `linha ${i}`,
    );
    const output = lines.join("\n");

    const result = formatToolOutput(output, "tail");

    expect(result.truncation.truncated).toBe(true);
    // As últimas linhas devem estar presentes
    expect(result.text).toContain(`linha ${DEFAULT_MAX_LINES + 49}`);
    // As primeiras linhas devem ser omitidas
    expect(result.text).not.toContain("linha 0");
  });

  it("não trunca quando output é menor que os limites", () => {
    const output = "log line 1\nlog line 2";
    const result = formatToolOutput(output, "tail");
    expect(result.truncation.truncated).toBe(false);
    expect(result.text).toBe(output);
  });
});

// ---------------------------------------------------------------------------
// Metadados de truncamento
// ---------------------------------------------------------------------------

describe("formatToolOutput — metadados", () => {
  it("details inclui totalLines e outputLines quando truncado", () => {
    const lines = Array.from(
      { length: DEFAULT_MAX_LINES + 500 },
      (_, i) => `x${i}`,
    );
    const output = lines.join("\n");

    const result = formatToolOutput(output, "head");

    expect(result.truncation.truncated).toBe(true);
    expect(result.truncation.totalLines).toBe(DEFAULT_MAX_LINES + 500);
    expect(result.truncation.outputLines).toBeLessThanOrEqual(
      DEFAULT_MAX_LINES,
    );
    expect(typeof result.truncation.totalBytes).toBe("number");
    expect(typeof result.truncation.outputBytes).toBe("number");
    expect(
      result.truncation.outputBytes! <= result.truncation.totalBytes!,
    ).toBe(true);
  });

  it("details tem truncated: false quando não há truncamento", () => {
    const result = formatToolOutput("pequeno");
    expect(result.truncation.truncated).toBe(false);
    expect(result.truncation.totalLines).toBeUndefined();
    expect(result.truncation.outputLines).toBeUndefined();
  });

  it("mensagem de truncamento inclui contagem de linhas e bytes omitidos", () => {
    const lines = Array.from(
      { length: DEFAULT_MAX_LINES + 10 },
      (_, i) => `linha ${i}`,
    );
    const output = lines.join("\n");

    const result = formatToolOutput(output, "head");

    expect(result.text).toMatch(/Saída truncada/);
    expect(result.text).toMatch(/omitidas/);
  });
});
