/**
 * Ferramenta: codegraph_status
 * CLI: codegraph status [path]
 *
 * Verifica saúde e estatísticas do índice CodeGraph.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CodegraphStatusParams, buildStatusArgs, type CodegraphStatusInput } from "../schemas.js";
import { runCodegraph } from "../cli.js";
import { formatToolOutput, TOOL_OUTPUT_MAX_BYTES_LABEL } from "../truncate.js";
import { TIMEOUTS } from "../config.js";
import { resolve } from "node:path";

export function registerCodegraphStatusTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "codegraph_status",
    label: "CodeGraph Status",
    description: `Check CodeGraph index health and project statistics. Output truncated at ${TOOL_OUTPUT_MAX_BYTES_LABEL}.`,
    promptSnippet: "Check CodeGraph index status for the current project",
    promptGuidelines: [
      "Use codegraph_status when you need to know whether CodeGraph is initialized and what languages/symbols are indexed before code exploration.",
    ],
    parameters: CodegraphStatusParams,
    async execute(_toolCallId, params: CodegraphStatusInput, signal, _onUpdate, ctx) {
      const cwd = resolve(ctx.cwd, params.path ?? ".");
      const result = await runCodegraph(pi, buildStatusArgs({ path: cwd }), { timeout: TIMEOUTS.quick }, signal);
      const { text, truncation } = formatToolOutput(result.stdout, "head");
      return {
        content: [{ type: "text", text }],
        details: { truncated: truncation.truncated, exitCode: result.code },
      };
    },
  });
}
