/**
 * Ferramenta: codegraph_files
 * CLI: codegraph files [path] --json
 *
 * Lista estrutura de arquivos indexada (mais rápida que filesystem scanning).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CodegraphFilesParams, buildFilesArgs, type CodegraphFilesInput } from "../schemas.js";
import { runCodegraph } from "../cli.js";
import { formatToolOutput, TOOL_OUTPUT_MAX_BYTES_LABEL } from "../truncate.js";
import { TIMEOUTS } from "../config.js";
import { resolve } from "node:path";

export function registerCodegraphFilesTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "codegraph_files",
    label: "CodeGraph Files",
    description: `Get indexed file structure from CodeGraph (faster than filesystem scanning). Output truncated at ${TOOL_OUTPUT_MAX_BYTES_LABEL}.`,
    promptSnippet: "Get indexed file tree from CodeGraph",
    promptGuidelines: [
      "Use codegraph_files to get the project file structure before using ls/find in large projects with .codegraph/ initialized.",
      "Use the filter parameter to narrow files by glob pattern (e.g., 'src/**') and maxDepth to limit directory depth.",
    ],
    parameters: CodegraphFilesParams,
    async execute(_toolCallId, params: CodegraphFilesInput, signal, _onUpdate, ctx) {
      const cwd = resolve(ctx.cwd, params.path ?? ".");
      const result = await runCodegraph(
        pi,
        buildFilesArgs({ ...params, path: cwd }),
        { timeout: TIMEOUTS.quick, parseJson: true },
        signal,
      );

      const json = result.json;
      const output = json != null ? JSON.stringify(json, null, 2) : result.stdout;
      const { text, truncation } = formatToolOutput(output, "head");

      return {
        content: [{ type: "text", text }],
        details: { truncated: truncation.truncated, raw: json ?? null, exitCode: result.code },
      };
    },
  });
}
