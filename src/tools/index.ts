/**
 * Ferramenta: codegraph_index
 * CLI: codegraph index [path]
 *
 * Executa indexação completa do projeto. Operação de longa duração.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CodegraphIndexParams, buildIndexArgs, type CodegraphIndexInput } from "../schemas.js";
import { runCodegraph } from "../cli.js";
import { formatToolOutput, TOOL_OUTPUT_MAX_BYTES_LABEL } from "../truncate.js";
import { TIMEOUTS } from "../config.js";
import { resolve } from "node:path";

export function registerCodegraphIndexTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "codegraph_index",
    label: "CodeGraph Index",
    description: `Run full CodeGraph indexing on a project. This is a long-running operation (up to several minutes for large codebases). Output truncated at ${TOOL_OUTPUT_MAX_BYTES_LABEL}.`,
    promptSnippet: "Build/rebuild the CodeGraph index for a project",
    promptGuidelines: [
      "Use codegraph_index after codegraph_init to build the initial index, or with force: true to rebuild an existing index.",
      "Indexing can take several minutes on large projects. Warn the user before running.",
      "For incremental updates after code changes, prefer codegraph_sync.",
    ],
    parameters: CodegraphIndexParams,
    async execute(_toolCallId, params: CodegraphIndexInput, signal, _onUpdate, ctx) {
      const cwd = resolve(ctx.cwd, params.path ?? ".");
      const result = await runCodegraph(
        pi,
        buildIndexArgs({ ...params, path: cwd }),
        { timeout: TIMEOUTS.indexing },
        signal,
      );

      const { text, truncation } = formatToolOutput(result.stdout, "tail");

      return {
        content: [{ type: "text", text: text || "CodeGraph indexing completed." }],
        details: { truncated: truncation.truncated, exitCode: result.code, force: params.force === true },
      };
    },
  });
}
