/**
 * Ferramenta: codegraph_sync
 * CLI: codegraph sync [path]
 *
 * Atualização incremental do índice após mudanças no código.
 */

import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { runCodegraph } from "../cli.js";
import { TIMEOUTS } from "../config.js";
import {
  buildSyncArgs,
  type CodegraphSyncInput,
  CodegraphSyncParams,
} from "../schemas.js";
import { formatToolOutput, TOOL_OUTPUT_MAX_BYTES_LABEL } from "../truncate.js";

export function registerCodegraphSyncTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "codegraph_sync",
    label: "CodeGraph Sync",
    description: `Incrementally update the CodeGraph index to reflect recent code changes. Faster than a full index. Output truncated at ${TOOL_OUTPUT_MAX_BYTES_LABEL}.`,
    promptSnippet: "Incrementally sync the CodeGraph index",
    promptGuidelines: [
      "Use codegraph_sync after making code changes to update the CodeGraph index incrementally (faster than codegraph_index).",
      "If sync fails or the index is too stale, use codegraph_index with force: true.",
    ],
    parameters: CodegraphSyncParams,
    async execute(
      _toolCallId,
      params: CodegraphSyncInput,
      signal,
      _onUpdate,
      ctx,
    ) {
      const cwd = resolve(ctx.cwd, params.path ?? ".");
      const result = await runCodegraph(
        pi,
        buildSyncArgs({ ...params, path: cwd }),
        { timeout: TIMEOUTS.query },
        signal,
      );

      const { text, truncation } = formatToolOutput(result.stdout, "tail");

      return {
        content: [{ type: "text", text: text || "CodeGraph sync completed." }],
        details: { truncated: truncation.truncated, exitCode: result.code },
      };
    },
  });
}
