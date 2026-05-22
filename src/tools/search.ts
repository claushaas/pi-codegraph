/**
 * Ferramenta: codegraph_search
 * CLI: codegraph query <search> --json
 *
 * Busca símbolos por nome em todo o codebase.
 */

import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { runCodegraph } from "../cli.js";
import { TIMEOUTS } from "../config.js";
import {
  buildSearchArgs,
  type CodegraphSearchInput,
  CodegraphSearchParams,
} from "../schemas.js";
import { formatToolOutput, TOOL_OUTPUT_MAX_BYTES_LABEL } from "../truncate.js";

export function registerCodegraphSearchTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "codegraph_search",
    label: "CodeGraph Search",
    description: `Search for symbols by name across the entire codebase. Returns JSON results; output truncated at ${TOOL_OUTPUT_MAX_BYTES_LABEL}.`,
    promptSnippet:
      "Search codebase symbols by name via CodeGraph (faster and cheaper than grep for symbol-level queries)",
    promptGuidelines: [
      "Use codegraph_search before grep/find/read when looking for functions, classes, methods, routes, constants, or other symbols by name in a project with .codegraph/ initialized.",
      "Prefer this over manual grep for symbol-level exploration; it is faster, cheaper, and returns indexed file locations.",
      "Use codegraph_search with kind filter (e.g., 'function', 'class') to narrow results to specific symbol types.",
      "After codegraph_search identifies relevant files, use read to verify exact content before editing.",
    ],
    parameters: CodegraphSearchParams,
    async execute(
      _toolCallId,
      params: CodegraphSearchInput,
      signal,
      _onUpdate,
      ctx,
    ) {
      const cwd = resolve(ctx.cwd, params.path ?? ".");
      const result = await runCodegraph(
        pi,
        buildSearchArgs({ ...params, path: cwd }),
        { timeout: TIMEOUTS.query, parseJson: true },
        signal,
      );

      const json = result.json;
      const summary =
        json != null
          ? summarizeSearchResults(json, params.query)
          : result.stdout;
      const { text, truncation } = formatToolOutput(summary, "head");

      return {
        content: [{ type: "text", text }],
        details: {
          truncated: truncation.truncated,
          raw: json ?? null,
          exitCode: result.code,
        },
      };
    },
  });
}

/** Gera resumo legível de resultados JSON de codegraph query. */
function summarizeSearchResults(json: unknown, query: string): string {
  if (!Array.isArray(json)) {
    return typeof json === "string" ? json : JSON.stringify(json, null, 2);
  }

  const results = json as Array<Record<string, unknown>>;
  if (results.length === 0) return `Nenhum símbolo encontrado para "${query}".`;

  const lines = [`Encontrados ${results.length} símbolos para "${query}":`];
  for (const r of results.slice(0, 50)) {
    const node = isRecord(r.node) ? r.node : r;
    const name =
      node.name ?? node.qualifiedName ?? r.name ?? r.symbol ?? "(sem nome)";
    const kind = node.kind ? ` [${node.kind}]` : "";
    const file = node.filePath ?? r.file ?? r.path ?? "";
    const line = node.startLine ?? r.line;
    const location = `${file}${line ? `:${line}` : ""}`;
    lines.push(`  ${name}${kind} — ${location}`);
  }

  if (results.length > 50) {
    lines.push(`  ... e mais ${results.length - 50} resultados.`);
  }

  return lines.join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
