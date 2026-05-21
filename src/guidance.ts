/**
 * Orientação contextual do agente.
 *
 * Detecta se o projeto atual tem .codegraph/ e injeta instruções
 * no system prompt via hook before_agent_start.
 *
 * Três níveis de orientação (SPEC §8):
 * 1. Suave — promptSnippet + promptGuidelines nas tools (Fase 5)
 * 2. Contextual — system prompt condicional (esta fase)
 * 3. Forte/opcional — interceptação de tool_call (fase futura)
 */

import { access } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Detecção
// ---------------------------------------------------------------------------

/**
 * Verifica se o diretório .codegraph/ existe no projeto.
 */
export async function hasCodegraph(cwd: string): Promise<boolean> {
  try {
    await access(join(cwd, ".codegraph"));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Textos de orientação
// ---------------------------------------------------------------------------

/** Instruções injetadas no system prompt quando .codegraph/ existe. */
export const CODEGRAPH_READY_GUIDANCE = [
  "## CodeGraph",
  "",
  "This project has CodeGraph initialized (.codegraph/ exists). Use the codegraph_* tools for code exploration:",
  "",
  "- **codegraph_search**: find symbols (functions, classes, methods, routes) by name — prefer this over grep/find for symbol-level queries.",
  "- **codegraph_context**: get relevant source code for architecture questions, flow understanding, or subsystem investigation.",
  "- **codegraph_files**: get the indexed file tree — faster than ls/find for project structure.",
  "- **codegraph_status**: check index health and statistics.",
  "- **codegraph_affected**: find test files affected by recent changes.",
  "",
  "After using CodeGraph to locate relevant code, use read to verify exact content before editing.",
  "Do NOT spawn sub-agents for exploration when CodeGraph tools can answer directly.",
].join("\n");

/** Instruções injetadas quando .codegraph/ NÃO existe. */
export const CODEGRAPH_MISSING_GUIDANCE = [
  "## CodeGraph",
  "",
  "This project does not have CodeGraph initialized. For broad code exploration tasks, consider suggesting `codegraph_init` before doing extensive manual searches (grep/find/ls).",
  "The user can also run `/codegraph-init` to initialize CodeGraph interactively.",
].join("\n");
