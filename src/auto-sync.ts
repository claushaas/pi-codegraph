/**
 * Sincronização automática do índice CodeGraph.
 *
 * Mantém o DB atualizado em três momentos:
 * - início de cada turno do agente, quando .codegraph/ existe;
 * - após ferramentas que alteram arquivos (edit/write) concluírem com sucesso;
 * - após saves no filesystem enquanto uma sessão Pi está aberta no projeto.
 */

import { type FSWatcher, watch } from "node:fs";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { getCodegraphInvocation, TIMEOUTS } from "./config.js";
import { hasCodegraph } from "./guidance.js";

const MUTATING_TOOLS = new Set(["edit", "write"]);
const FILE_WATCH_DEBOUNCE_MS = 750;
const IGNORED_FILE_CHANGE_PREFIXES = [
  ".git/",
  ".codegraph/",
  "node_modules/",
  "dist/",
  "coverage/",
];

interface AutoSyncState {
  inFlight: Map<string, Promise<void>>;
  pendingFileMutation: Set<string>;
  watchers: Map<string, FSWatcher>;
  debounceTimers: Map<string, ReturnType<typeof setTimeout>>;
}

export function shouldIgnoreFileChange(
  filename: string | Buffer | null,
): boolean {
  if (filename == null) return false;

  const normalized = filename.toString().replaceAll("\\", "/");
  return IGNORED_FILE_CHANGE_PREFIXES.some(
    (prefix) =>
      normalized === prefix.slice(0, -1) || normalized.startsWith(prefix),
  );
}

async function performSync(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  cwd: string,
): Promise<void> {
  ctx.ui.setStatus?.("codegraph", "CodeGraph: syncing…");

  const invocation = getCodegraphInvocation();
  const result = await pi.exec(
    invocation.bin,
    [...invocation.prefixArgs, "sync", cwd, "--quiet"],
    {
      signal: ctx.signal,
      timeout: TIMEOUTS.query,
    },
  );

  if (result.code !== 0) {
    const details =
      result.stderr.trim() || result.stdout.trim() || "(no output)";
    throw new Error(`codegraph sync failed (code ${result.code}): ${details}`);
  }
}

function scheduleFileMutationSync(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  state: AutoSyncState,
): void {
  const cwd = ctx.cwd;
  const existingTimer = state.debounceTimers.get(cwd);
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(() => {
    state.debounceTimers.delete(cwd);
    void runAutoSync(pi, ctx, state, "file_mutation");
  }, FILE_WATCH_DEBOUNCE_MS);

  state.debounceTimers.set(cwd, timer);
}

async function registerFileWatcher(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  state: AutoSyncState,
): Promise<void> {
  const cwd = ctx.cwd;
  if (state.watchers.has(cwd)) return;

  const ready = await hasCodegraph(cwd);
  if (!ready) return;

  try {
    const watcher = watch(cwd, { recursive: true }, (_eventType, filename) => {
      if (shouldIgnoreFileChange(filename)) return;
      scheduleFileMutationSync(pi, ctx, state);
    });

    watcher.on("error", (err) => {
      ctx.ui.notify?.(
        `CodeGraph file watcher failed: ${(err as Error).message}`,
        "warning",
      );
      state.watchers.delete(cwd);
    });

    state.watchers.set(cwd, watcher);
  } catch (err) {
    ctx.ui.notify?.(
      `CodeGraph file watcher unavailable: ${(err as Error).message}`,
      "warning",
    );
  }
}

function closeFileWatcher(ctx: ExtensionContext, state: AutoSyncState): void {
  const cwd = ctx.cwd;

  const timer = state.debounceTimers.get(cwd);
  if (timer) clearTimeout(timer);
  state.debounceTimers.delete(cwd);

  state.watchers.get(cwd)?.close();
  state.watchers.delete(cwd);
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
    if (reason === "file_mutation") {
      state.pendingFileMutation.add(cwd);
    }

    try {
      await existing;
    } catch {
      // O primeiro sync já atualizou status/notificação; não propagar erro duplicado.
    }
    return;
  }

  let shouldNotifyFileMutationFailure = reason === "file_mutation";

  const promise = (async () => {
    try {
      while (true) {
        state.pendingFileMutation.delete(cwd);
        await performSync(pi, ctx, cwd);

        if (!state.pendingFileMutation.has(cwd)) break;
        shouldNotifyFileMutationFailure = true;
      }

      ctx.ui.setStatus?.("codegraph", "CodeGraph: ready");
    } catch (err) {
      ctx.ui.setStatus?.("codegraph", "CodeGraph: sync failed");
      if (
        shouldNotifyFileMutationFailure ||
        state.pendingFileMutation.has(cwd)
      ) {
        ctx.ui.notify?.(
          `CodeGraph sync failed after file change: ${(err as Error).message}`,
          "warning",
        );
      }
    } finally {
      state.pendingFileMutation.delete(cwd);
    }
  })();

  state.inFlight.set(cwd, promise);

  try {
    await promise;
  } finally {
    state.inFlight.delete(cwd);
  }
}

export function registerCodegraphAutoSync(pi: ExtensionAPI): void {
  const state: AutoSyncState = {
    inFlight: new Map(),
    pendingFileMutation: new Set(),
    watchers: new Map(),
    debounceTimers: new Map(),
  };

  pi.on("session_start", async (_event, ctx) => {
    await registerFileWatcher(pi, ctx, state);
  });

  pi.on("before_agent_start", async (_event, ctx) => {
    await registerFileWatcher(pi, ctx, state);
    await runAutoSync(pi, ctx, state, "turn_start");
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    closeFileWatcher(ctx, state);
  });

  pi.on("tool_result", async (event, ctx) => {
    if (!MUTATING_TOOLS.has(event.toolName)) return;
    if (event.isError) return;

    await runAutoSync(pi, ctx, state, "file_mutation");
  });
}
