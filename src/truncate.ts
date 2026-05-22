/**
 * Utilitários de truncamento de saída.
 *
 * Aplica limites consistentes com o Pi (50KB / 2000 linhas, o que ocorrer primeiro)
 * e adiciona mensagem informativa quando há truncamento.
 *
 * Política por modo:
 * - "head": mantém as primeiras linhas/bytes — para search, files, context.
 * - "tail": mantém as últimas linhas/bytes   — para logs de index, sync, init.
 */

import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,
  truncateTail,
} from "@earendil-works/pi-coding-agent";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface TruncationDetails {
  truncated: boolean;
  totalLines?: number;
  outputLines?: number;
  totalBytes?: number;
  outputBytes?: number;
}

export interface FormatToolOutputResult {
  /** Texto pronto para ser enviado ao LLM em content[{ type: "text", text }]. */
  text: string;
  /** Metadados de truncamento para incluir em details da tool. */
  truncation: TruncationDetails;
}

// ---------------------------------------------------------------------------
// Constantes públicas (para documentação em descriptions das tools)
// ---------------------------------------------------------------------------

/** Limite de linhas documentado. */
export const TOOL_OUTPUT_MAX_LINES = DEFAULT_MAX_LINES;

/** Limite de bytes documentado (formato humano). */
export const TOOL_OUTPUT_MAX_BYTES_LABEL = formatSize(DEFAULT_MAX_BYTES);

// ---------------------------------------------------------------------------
// Implementação
// ---------------------------------------------------------------------------

/**
 * Aplica truncamento a uma saída de ferramenta e gera mensagem informativa.
 *
 * @param output  Texto bruto da saída da CLI.
 * @param mode    "head" (padrão) mantém o início; "tail" mantém o final.
 * @returns       Texto truncado + metadados.
 */
export function formatToolOutput(
  output: string,
  mode: "head" | "tail" = "head",
): FormatToolOutputResult {
  const truncation =
    mode === "tail"
      ? truncateTail(output, {
          maxLines: DEFAULT_MAX_LINES,
          maxBytes: DEFAULT_MAX_BYTES,
        })
      : truncateHead(output, {
          maxLines: DEFAULT_MAX_LINES,
          maxBytes: DEFAULT_MAX_BYTES,
        });

  const details: TruncationDetails = { truncated: truncation.truncated };

  if (truncation.truncated) {
    details.totalLines = truncation.totalLines;
    details.outputLines = truncation.outputLines;
    details.totalBytes = truncation.totalBytes;
    details.outputBytes = truncation.outputBytes;

    const omittedLines = truncation.totalLines - truncation.outputLines;
    const omittedBytes = truncation.totalBytes - truncation.outputBytes;

    const notice = [
      "",
      `[Saída truncada: exibindo ${truncation.outputLines} de ${truncation.totalLines} linhas`,
      `(${formatSize(truncation.outputBytes)} de ${formatSize(truncation.totalBytes)}).`,
      `${omittedLines} linhas (${formatSize(omittedBytes)}) omitidas.]`,
    ].join(" ");

    return {
      text: truncation.content + notice,
      truncation: details,
    };
  }

  return {
    text: truncation.content,
    truncation: details,
  };
}
