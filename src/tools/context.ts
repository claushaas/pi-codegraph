/**
 * Ferramenta: codegraph_context
 * CLI: codegraph context <task>
 *
 * Constrói contexto de código relevante para uma tarefa.
 * ⚠️ Pode retornar bastante código — truncado rigorosamente.
 */

import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { runCodegraph } from "../cli.js";
import { TIMEOUTS } from "../config.js";
import {
  buildContextArgs,
  type CodegraphContextInput,
  CodegraphContextParams,
} from "../schemas.js";
import { formatToolOutput, TOOL_OUTPUT_MAX_BYTES_LABEL } from "../truncate.js";

export function registerCodegraphContextTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "codegraph_context",
    label: "CodeGraph Context",
    description: `Build relevant code context for a task description. Returns source code sections from relevant files. ⚠️ This tool may return large amounts of code — output is truncated at ${TOOL_OUTPUT_MAX_BYTES_LABEL}. For broad tasks, prefer more specific queries or use codegraph_search first to narrow the scope.`,
    promptSnippet: "Build code context for a task via CodeGraph",
    promptGuidelines: [
      "Use codegraph_context first for architecture questions, flow understanding, feature tracing, or subsystem investigation — it returns relevant source code sections in one call.",
      "Prefer codegraph_context over reading multiple files manually when exploring how a feature or subsystem works.",
      "If the task is broad, use codegraph_search first to find symbols or files, then codegraph_context with a specific task.",
      "Be specific in the task description. Vague tasks (e.g., 'explain the codebase') produce too much output and are likely to be truncated.",
      "After codegraph_context, use read to verify exact lines before editing.",
    ],
    parameters: CodegraphContextParams,
    async execute(
      _toolCallId,
      params: CodegraphContextInput,
      signal,
      _onUpdate,
      ctx,
    ) {
      const cwd = resolve(ctx.cwd, params.path ?? ".");
      const result = await runCodegraph(
        pi,
        buildContextArgs({ ...params, path: cwd }),
        { timeout: TIMEOUTS.query },
        signal,
      );

      const { text, truncation } = formatToolOutput(result.stdout, "head");

      return {
        content: [{ type: "text", text }],
        details: {
          truncated: truncation.truncated,
          task: params.task,
          exitCode: result.code,
          ...(truncation.truncated
            ? {
                totalLines: truncation.totalLines,
                outputLines: truncation.outputLines,
              }
            : {}),
        },
      };
    },
  });
}
