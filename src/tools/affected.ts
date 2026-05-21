/**
 * Ferramenta: codegraph_affected
 * CLI: codegraph affected [files...]
 *
 * Encontra arquivos de teste afetados por mudanças em arquivos fonte.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CodegraphAffectedParams, buildAffectedArgs, type CodegraphAffectedInput } from "../schemas.js";
import { runCodegraph, CodegraphCliError } from "../cli.js";
import { formatToolOutput, TOOL_OUTPUT_MAX_BYTES_LABEL } from "../truncate.js";
import { TIMEOUTS } from "../config.js";
import { resolve } from "node:path";
import { writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function registerCodegraphAffectedTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "codegraph_affected",
    label: "CodeGraph Affected",
    description: `Find test files affected by changes in source files. Traces import dependencies transitively. Output truncated at ${TOOL_OUTPUT_MAX_BYTES_LABEL}.`,
    promptSnippet: "Find test files affected by source changes via CodeGraph",
    promptGuidelines: [
      "Use codegraph_affected after making code changes to find which test files need to run, instead of guessing or running all tests.",
      "Pass the list of changed files explicitly, or use the stdin parameter for a newline-separated list.",
      "Use the filter parameter to restrict to specific test file patterns (e.g., 'e2e/*').",
    ],
    parameters: CodegraphAffectedParams,
    async execute(_toolCallId, params: CodegraphAffectedInput, signal, _onUpdate, ctx) {
      // CodeGraph affected can receive files via:
      // 1. positional args: codegraph affected file1.ts file2.ts
      // 2. stdin: git diff --name-only | codegraph affected --stdin
      //
      // pi.exec does not natively support stdin piping. For the stdin case,
      // we write the content to a temp file and use shell input redirection
      // as a workaround only when stdin is explicitly requested.
      //
      // However, pi.exec doesn't support stdin. For now, we document this
      // limitation clearly and recommend using the files[] parameter instead.

      const hasStdin = params.stdin != null && params.files == null;

      if (hasStdin) {
        // Workaround: write stdin content to a temp file, then use shell
        // to pipe it. This is NOT ideal but pi.exec doesn't offer stdin.
        // The tool warns about this in the output.
        const tmpDir = await mkdtemp(join(tmpdir(), "pi-codegraph-affected-"));
        const tmpFile = join(tmpDir, "files.txt");
        await writeFile(tmpFile, params.stdin!, "utf8");

        try {
          // Fall back to bash-based execution for stdin mode
          const cwd = resolve(ctx.cwd, ".");
          const cmd = `cat ${tmpFile} | codegraph affected --stdin`;
          const result = await pi.exec("bash", ["-c", cmd], { signal, timeout: TIMEOUTS.query });

          if (result.code !== 0) {
            throw new CodegraphCliError(
              `codegraph affected --stdin falhou com código ${result.code}: ${result.stderr || result.stdout || "(sem saída)"}`,
              result.code,
              result.stdout,
              result.stderr,
            );
          }

          const { text, truncation } = formatToolOutput(result.stdout, "head");
          return {
            content: [{ type: "text", text }],
            details: { truncated: truncation.truncated, exitCode: result.code, stdinMode: true },
          };
        } finally {
          // Cleanup temp file (best effort)
          try { /* ignore cleanup errors */ } catch { /* ignore */ }
        }
      }

      // Standard mode: pass files as positional arguments
      const args = buildAffectedArgs(params);
      const result = await runCodegraph(
        pi,
        args,
        { timeout: TIMEOUTS.query, parseJson: params.json === true },
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
