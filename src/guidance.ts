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
  "This project has CodeGraph initialized (.codegraph/ exists). Default to the codegraph_* tools for code exploration before manual filesystem scanning:",
  "",
  "- **codegraph_search**: use first when looking for functions, classes, methods, routes, constants, or other symbols by name. Prefer it over grep/find/read for symbol-level queries.",
  "- **codegraph_context**: use first for architecture questions, feature flow, subsystem investigation, or when you would otherwise read multiple files manually.",
  "- **codegraph_files**: use first to inspect indexed project structure before ls/find/tree, especially in broad or unfamiliar areas.",
  "- **codegraph_status**: check index health and statistics when freshness or availability is uncertain.",
  "- **codegraph_affected**: after code changes, use it to identify focused tests instead of guessing or running everything by default.",
  "",
  "Default workflow:",
  "1. For broad exploration, call codegraph_files/search/context before grep/find/ls or broad read calls.",
  "2. Use read only after CodeGraph has identified candidate files, or when the user/task already names an exact file path.",
  "3. If you skip CodeGraph for a code-exploration step while it is available, briefly state why the manual tool is more appropriate.",
  "4. After editing files, prefer codegraph_affected to choose tests, then run the focused tests.",
  "",
  "Do NOT spawn sub-agents for exploration when CodeGraph tools can answer directly.",
].join("\n");

/** Instruções injetadas quando .codegraph/ NÃO existe. */
export const CODEGRAPH_MISSING_GUIDANCE = [
  "## CodeGraph",
  "",
  "This project does not have CodeGraph initialized. For broad code exploration tasks, consider suggesting `codegraph_init` before doing extensive manual searches (grep/find/ls).",
  "The user can also run `/codegraph-init` to initialize CodeGraph interactively.",
].join("\n");
