/**
 * Comandos slash para interação humana com CodeGraph.
 *
 * - /codegraph-status : exibe status do CodeGraph no projeto atual
 * - /codegraph-init   : inicializa CodeGraph interativamente (com confirmação)
 * - /codegraph-index  : indexa o projeto (com confirmação)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getCodegraphBin, TIMEOUTS } from "./config.js";
import { hasCodegraph } from "./guidance.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Executa codegraph e retorna stdout, ou lança. */
async function execCodegraph(
  pi: ExtensionAPI,
  args: string[],
  timeout: number,
): Promise<string> {
  const result = await pi.exec(getCodegraphBin(), args, { timeout });
  if (result.code !== 0) {
    throw new Error(
      `codegraph ${args[0] ?? ""} failed (code ${result.code}): ${result.stderr || result.stdout || "(no output)"}`,
    );
  }
  return result.stdout.trim();
}

/** Extrai a primeira linha significante de uma saída para notificação. */
function firstLine(output: string, maxLen = 120): string {
  const line = output.split("\n").find((l) => l.trim().length > 0) ?? output;
  return line.length > maxLen ? line.slice(0, maxLen) + "…" : line;
}

// ---------------------------------------------------------------------------
// /codegraph-status
// ---------------------------------------------------------------------------

export function registerCodegraphStatusCommand(pi: ExtensionAPI): void {
  pi.registerCommand("codegraph-status", {
    description: "Show CodeGraph index status for the current project",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        // Modo sem UI: executa silenciosamente e retorna
        try {
          const output = await execCodegraph(pi, ["status", ctx.cwd], TIMEOUTS.quick);
          // Em modo print/json, o output vai para o log/stream
          ctx.ui.notify?.(firstLine(output), "info");
        } catch (err) {
          ctx.ui.notify?.(`CodeGraph: ${(err as Error).message}`, "error");
        }
        return;
      }

      try {
        const output = await execCodegraph(pi, ["status", ctx.cwd], TIMEOUTS.quick);
        ctx.ui.notify(firstLine(output), "info");
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes("not initialized") || msg.includes("ENOENT")) {
          ctx.ui.notify("CodeGraph not initialized. Run /codegraph-init to set up.", "warning");
        } else {
          ctx.ui.notify(`CodeGraph error: ${msg}`, "error");
        }
      }
    },
  });
}

// ---------------------------------------------------------------------------
// /codegraph-init
// ---------------------------------------------------------------------------

export function registerCodegraphInitCommand(pi: ExtensionAPI): void {
  pi.registerCommand("codegraph-init", {
    description: "Initialize CodeGraph in the current project",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify?.("Run codegraph init in the project directory to initialize.", "info");
        return;
      }

      const alreadyInit = await hasCodegraph(ctx.cwd);
      if (alreadyInit) {
        const redo = await ctx.ui.confirm(
          "CodeGraph already initialized",
          "Re-initialize? This will overwrite the existing config.",
        );
        if (!redo) return;
      }

      const ok = await ctx.ui.confirm(
        "Initialize CodeGraph",
        `Run codegraph init in ${ctx.cwd}?`,
      );
      if (!ok) return;

      ctx.ui.setStatus?.("codegraph", "CodeGraph: initializing…");

      try {
        await execCodegraph(pi, ["init", ctx.cwd], TIMEOUTS.indexing);
        ctx.ui.setStatus?.("codegraph", "CodeGraph: initialized ✓");
        ctx.ui.notify("CodeGraph initialized successfully.", "info");

        // Oferecer indexação
        const doIndex = await ctx.ui.confirm(
          "Index now?",
          "CodeGraph is initialized. Build the index now? (recommended, may take a few minutes)",
        );
        if (doIndex) {
          ctx.ui.setStatus?.("codegraph", "CodeGraph: indexing…");
          await execCodegraph(pi, ["index", ctx.cwd], TIMEOUTS.indexing);
          ctx.ui.setStatus?.("codegraph", "CodeGraph: ready");
          ctx.ui.notify("Indexing complete.", "info");
        } else {
          ctx.ui.notify("Run /codegraph-index later to build the index.", "info");
        }
      } catch (err) {
        ctx.ui.setStatus?.("codegraph", undefined);
        ctx.ui.notify(`Init failed: ${(err as Error).message}`, "error");
      }
    },
  });
}

// ---------------------------------------------------------------------------
// /codegraph-index
// ---------------------------------------------------------------------------

export function registerCodegraphIndexCommand(pi: ExtensionAPI): void {
  pi.registerCommand("codegraph-index", {
    description: "Build/rebuild the CodeGraph index for the current project",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify?.("Run codegraph index in the project directory to build the index.", "info");
        return;
      }

      const initialized = await hasCodegraph(ctx.cwd);
      if (!initialized) {
        ctx.ui.notify("CodeGraph not initialized. Run /codegraph-init first.", "warning");
        return;
      }

      const ok = await ctx.ui.confirm(
        "Build CodeGraph index",
        `Run codegraph index in ${ctx.cwd}? This may take several minutes on large projects.`,
      );
      if (!ok) return;

      ctx.ui.setStatus?.("codegraph", "CodeGraph: indexing…");

      try {
        await execCodegraph(pi, ["index", ctx.cwd], TIMEOUTS.indexing);
        ctx.ui.setStatus?.("codegraph", "CodeGraph: ready");
        ctx.ui.notify("Indexing complete.", "info");
      } catch (err) {
        ctx.ui.setStatus?.("codegraph", undefined);
        ctx.ui.notify(`Indexing failed: ${(err as Error).message}`, "error");
      }
    },
  });
}

// ---------------------------------------------------------------------------
// session_start: status opcional
// ---------------------------------------------------------------------------

/** Registra hook session_start para indicação de status no footer. */
export function registerSessionStartStatus(pi: ExtensionAPI): void {
  let notified = false; // notificar apenas uma vez por sessão

  pi.on("session_start", async (_event, ctx) => {
    notified = false;

    if (!ctx.hasUI) return;

    const ready = await hasCodegraph(ctx.cwd);
    if (ready) {
      ctx.ui.setStatus?.("codegraph", "CodeGraph: ready");
    }

    // Re-hook: escuta o primeiro agent_start para notificar se não inicializado
    // (evita poluir o startup)
    const unsub = pi.on("agent_start", async () => {
      if (notified) return;
      notified = true;

      const readyNow = await hasCodegraph(ctx.cwd);
      if (!readyNow) {
        ctx.ui.notify(
          "CodeGraph not initialized. Run /codegraph-init to set up semantic code search.",
          "info",
        );
      }
    });
  });
}
