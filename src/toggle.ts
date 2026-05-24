/**
 * Toggle estado enabled/disabled da extensão pi-codegraph.
 *
 * Quando disabled:
 * - Ferramentas codegraph_* são removidas das ferramentas ativas
 * - before_agent_start não injeta orientação
 * - Auto-sync é pausado
 * - O status no footer mostra "CodeGraph: disabled"
 *
 * Estado persiste via pi.appendEntry na sessão e é restaurado em session_start.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ---------------------------------------------------------------------------
// Nomes de ferramentas
// ---------------------------------------------------------------------------

export const CODEGRAPH_TOOL_NAMES = [
  "codegraph_status",
  "codegraph_search",
  "codegraph_files",
  "codegraph_context",
  "codegraph_init",
  "codegraph_index",
  "codegraph_sync",
  "codegraph_affected",
] as const;

const CODEGRAPH_TOOL_SET = new Set<string>(CODEGRAPH_TOOL_NAMES);

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

const CUSTOM_TYPE = "codegraph-toggle" as const;

interface ToggleState {
  enabled: boolean;
}

interface ToggleContextUi {
  notify?: (message: string, level: "info" | "warning" | "error") => void;
  setStatus?: (key: string, value: string | undefined) => void;
}

interface ToggleContext {
  ui?: ToggleContextUi;
}

interface RestoreContext {
  sessionManager?: {
    getBranch?: () => Array<{
      type: string;
      customType?: string;
      data?: unknown;
    }>;
  };
}

let enabled = true;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ativa todas as ferramentas codegraph via pi.setActiveTools. */
function activateTools(pi: ExtensionAPI): void {
  if (typeof pi.getActiveTools !== "function") return;
  if (typeof pi.setActiveTools !== "function") return;
  const current = pi.getActiveTools();
  const currentSet = new Set(current);
  const alreadyActive = CODEGRAPH_TOOL_NAMES.filter((n) => currentSet.has(n));
  if (alreadyActive.length === CODEGRAPH_TOOL_NAMES.length) return;
  const merged = [
    ...current,
    ...CODEGRAPH_TOOL_NAMES.filter((n) => !currentSet.has(n)),
  ];
  pi.setActiveTools(merged);
}

/** Remove todas as ferramentas codegraph das ferramentas ativas. */
function deactivateTools(pi: ExtensionAPI): void {
  if (typeof pi.getActiveTools !== "function") return;
  if (typeof pi.setActiveTools !== "function") return;
  const current = pi.getActiveTools();
  const filtered = current.filter((n) => !CODEGRAPH_TOOL_SET.has(n));
  if (filtered.length === current.length) return;
  pi.setActiveTools(filtered);
}

function persistState(pi: ExtensionAPI): void {
  if (typeof pi.appendEntry !== "function") return;
  pi.appendEntry<ToggleState>(CUSTOM_TYPE, { enabled });
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export function isEnabled(): boolean {
  return enabled;
}

export function enable(pi: ExtensionAPI, ctx: ToggleContext): void {
  if (enabled) return;
  enabled = true;
  activateTools(pi);
  persistState(pi);
  ctx.ui?.setStatus?.("codegraph", "CodeGraph: ready");
  ctx.ui?.notify?.("CodeGraph enabled.", "info");
}

export function disable(pi: ExtensionAPI, ctx: ToggleContext): void {
  if (!enabled) return;
  enabled = false;
  deactivateTools(pi);
  persistState(pi);
  ctx.ui?.setStatus?.("codegraph", "CodeGraph: disabled");
  ctx.ui?.notify?.("CodeGraph disabled.", "info");
}

export function toggle(pi: ExtensionAPI, ctx: ToggleContext): void {
  if (enabled) {
    disable(pi, ctx);
  } else {
    enable(pi, ctx);
  }
}

/**
 * Restaura estado salvo na sessão (último entry do tipo codegraph-toggle no branch).
 * Chamado em session_start.
 */
export function restoreFromSession(
  pi: ExtensionAPI,
  ctx: RestoreContext,
): void {
  const branch = ctx.sessionManager?.getBranch?.() ?? [];
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry.type === "custom" && entry.customType === CUSTOM_TYPE) {
      const data = entry.data as ToggleState | undefined;
      if (data && !data.enabled) {
        enabled = false;
        deactivateTools(pi);
        return;
      }
      break;
    }
  }
  // Nenhum estado salvo ou último estado = enabled → garante que ferramentas estão ativas
  enabled = true;
  activateTools(pi);
}
