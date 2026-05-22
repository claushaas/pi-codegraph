/**
 * Ferramenta: codegraph_files
 * CLI: codegraph files [path] --json
 *
 * Lista estrutura de arquivos indexada (mais rápida que filesystem scanning).
 */

import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { runCodegraph } from "../cli.js";
import { TIMEOUTS } from "../config.js";
import {
  buildFilesArgs,
  type CodegraphFilesInput,
  CodegraphFilesParams,
} from "../schemas.js";
import { formatToolOutput, TOOL_OUTPUT_MAX_BYTES_LABEL } from "../truncate.js";

export function registerCodegraphFilesTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "codegraph_files",
    label: "CodeGraph Files",
    description: `Get indexed file structure from CodeGraph (faster than filesystem scanning). Output truncated at ${TOOL_OUTPUT_MAX_BYTES_LABEL}.`,
    promptSnippet: "Get indexed file tree from CodeGraph",
    promptGuidelines: [
      "Use codegraph_files before ls/find/tree when you need project structure in a repository with .codegraph/ initialized.",
      "Prefer this over manual directory scanning for broad exploration; it returns the indexed file tree quickly.",
      "Use the filter parameter to narrow files by glob pattern (e.g., 'src/**') and maxDepth to limit directory depth.",
      "After codegraph_files identifies candidate files, use read only for the exact files you need to inspect.",
    ],
    parameters: CodegraphFilesParams,
    async execute(
      _toolCallId,
      params: CodegraphFilesInput,
      signal,
      _onUpdate,
      ctx,
    ) {
      const cwd = resolve(ctx.cwd, params.path ?? ".");
      const result = await runCodegraph(
        pi,
        buildFilesArgs({ ...params, path: cwd }),
        { timeout: TIMEOUTS.quick, parseJson: true },
        signal,
      );

      const json = result.json;
      const output =
        json != null ? JSON.stringify(json, null, 2) : result.stdout;
      const { text, truncation } = formatToolOutput(output, "head");

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
