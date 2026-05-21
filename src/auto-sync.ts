/**
 * Sincronização automática do índice CodeGraph.
 *
 * Mantém o DB atualizado em dois momentos:
 * - início de cada turno do agente, quando .codegraph/ existe;
 * - após ferramentas que alteram arquivos (edit/write) concluírem com sucesso.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getCodegraphBin, TIMEOUTS } from "./config.js";
import { hasCodegraph } from "./guidance.js";

const MUTATING_TOOLS = new Set(["edit", "write"]);

interface AutoSyncState {
  inFlight: Map<string, Promise<void>>;
}

async function runAutoSync(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  state: AutoSyncState,
  reason: "turn_start" | "file_mutation",
): Promise<void> {
  const cwd = ctx.cwd;
  const ready = await hasCodegraph(cwd);
  if (!ready) return;

  const existing = state.inFlight.get(cwd);
  if (existing) {
    try {
      await existing;
    } catch {
      // O primeiro sync já atualizou status/notificação; não propagar erro duplicado.
    }
    return;
  }

  ctx.ui.setStatus?.("codegraph", "CodeGraph: syncing…");

  const promise = (async () => {
    const result = await pi.exec(getCodegraphBin(), ["sync", cwd, "--quiet"], {
      signal: ctx.signal,
      timeout: TIMEOUTS.query,
    });

    if (result.code !== 0) {
      const details = result.stderr.trim() || result.stdout.trim() || "(no output)";
      throw new Error(`codegraph sync failed (code ${result.code}): ${details}`);
    }

    ctx.ui.setStatus?.("codegraph", "CodeGraph: ready");
  })();

  state.inFlight.set(cwd, promise);

  try {
    await promise;
  } catch (err) {
    ctx.ui.setStatus?.("codegraph", "CodeGraph: sync failed");
    if (reason === "file_mutation") {
      ctx.ui.notify?.(`CodeGraph sync failed after file change: ${(err as Error).message}`, "warning");
    }
  } finally {
    state.inFlight.delete(cwd);
  }
}

export function registerCodegraphAutoSync(pi: ExtensionAPI): void {
  const state: AutoSyncState = { inFlight: new Map() };

  pi.on("before_agent_start", async (_event, ctx) => {
    await runAutoSync(pi, ctx, state, "turn_start");
  });

  pi.on("tool_result", async (event, ctx) => {
    if (!MUTATING_TOOLS.has(event.toolName)) return;
    if (event.isError) return;

    await runAutoSync(pi, ctx, state, "file_mutation");
  });
}
