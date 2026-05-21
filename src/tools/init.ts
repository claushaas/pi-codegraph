/**
 * Ferramenta: codegraph_init
 * CLI: codegraph init [path]
 *
 * Inicializa CodeGraph em um projeto. Opcionalmente, também indexa.
 * NÃO interativo por padrão — interação humana via slash command.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CodegraphInitParams, buildInitArgs, type CodegraphInitInput } from "../schemas.js";
import { runCodegraph } from "../cli.js";
import { formatToolOutput, TOOL_OUTPUT_MAX_BYTES_LABEL } from "../truncate.js";
import { TIMEOUTS } from "../config.js";
import { resolve } from "node:path";

export function registerCodegraphInitTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "codegraph_init",
    label: "CodeGraph Init",
    description: `Initialize CodeGraph in a project. Optionally also index after init. Non-interactive by default. Output truncated at ${TOOL_OUTPUT_MAX_BYTES_LABEL}.`,
    promptSnippet: "Initialize CodeGraph in a project",
    promptGuidelines: [
      "Use codegraph_init when the user asks to set up CodeGraph or when you detect .codegraph/ is missing and exploration would benefit from indexing.",
      "After codegraph_init, run codegraph_index to build the full index if --index was not passed.",
      "Do not set interactive: true — the LLM tool runs non-interactively by default. Use the /codegraph-init slash command for interactive setup.",
    ],
    parameters: CodegraphInitParams,
    async execute(_toolCallId, params: CodegraphInitInput, signal, _onUpdate, ctx) {
      const cwd = resolve(ctx.cwd, params.path ?? ".");
      const result = await runCodegraph(
        pi,
        buildInitArgs({ path: cwd, index: params.index }),
        { timeout: TIMEOUTS.indexing },
        signal,
      );

      const { text, truncation } = formatToolOutput(result.stdout, "tail");

      return {
        content: [{ type: "text", text: text || "CodeGraph initialized successfully." }],
        details: { truncated: truncation.truncated, exitCode: result.code, indexed: params.index === true },
      };
    },
  });
}
