/**
 * pi-codegraph — Pi coding agent extension for CodeGraph CLI integration.
 *
 * ## Decisões técnicas (Fase 0)
 *
 * - Integração exclusivamente via CLI (`codegraph ...`), sem MCP.
 * - Ferramentas MCP sem equivalente CLI público documentado
 *   (codegraph_callers, codegraph_callees, codegraph_impact, codegraph_node)
 *   ficam para fase futura.
 * - O binário `codegraph` é resolvido por:
 *     1. variável de ambiente `PI_CODEGRAPH_BIN`, ou
 *     2. `codegraph` no PATH (provido por @colbymchenry/codegraph em dependencies).
 * - Nenhuma dependência de configurações do Claude Code, Cursor, Codex CLI ou opencode.
 * - Saídas truncadas a 50KB / 2000 linhas, consistente com limites do Pi.
 * - Parâmetros validados com typebox; execução via pi.exec() sem shell interpolation.
 * - Orientação ativa do agente injetada via before_agent_start quando .codegraph/ existe.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerCodegraphAutoSync } from "./src/auto-sync.js";
import {
  registerCodegraphIndexCommand,
  registerCodegraphInitCommand,
  registerCodegraphStatusCommand,
  registerCodegraphSyncCommand,
  registerCodegraphToggleCommand,
  registerSessionStartStatus,
} from "./src/commands.js";
import {
  CODEGRAPH_MISSING_GUIDANCE,
  CODEGRAPH_READY_GUIDANCE,
  hasCodegraph,
} from "./src/guidance.js";
import { isEnabled, restoreFromSession } from "./src/toggle.js";
import { registerCodegraphAffectedTool } from "./src/tools/affected.js";
import { registerCodegraphContextTool } from "./src/tools/context.js";
import { registerCodegraphFilesTool } from "./src/tools/files.js";
import { registerCodegraphIndexTool } from "./src/tools/index.js";
import { registerCodegraphInitTool } from "./src/tools/init.js";
import { registerCodegraphSearchTool } from "./src/tools/search.js";
import { registerCodegraphStatusTool } from "./src/tools/status.js";
import { registerCodegraphSyncTool } from "./src/tools/sync.js";

export default function piCodegraph(pi: ExtensionAPI): void {
  // Fase 5: registrar ferramentas
  registerCodegraphStatusTool(pi);
  registerCodegraphSearchTool(pi);
  registerCodegraphFilesTool(pi);
  registerCodegraphContextTool(pi);
  registerCodegraphInitTool(pi);
  registerCodegraphIndexTool(pi);
  registerCodegraphSyncTool(pi);
  registerCodegraphAffectedTool(pi);

  // Restaura estado do toggle no início da sessão
  pi.on("session_start", async (_event, ctx) => {
    restoreFromSession(pi, ctx);
  });

  // Fase 6: sincronização automática e orientação contextual do agente
  registerCodegraphAutoSync(pi);

  pi.on("before_agent_start", async (_event, ctx) => {
    // Se a extensão foi desativada, não injeta orientação
    if (!isEnabled()) return;

    const ready = await hasCodegraph(ctx.cwd);
    const guidance = ready
      ? CODEGRAPH_READY_GUIDANCE
      : CODEGRAPH_MISSING_GUIDANCE;

    // Injeta orientação no final do system prompt (chained)
    const current = ctx.getSystemPrompt();
    return {
      systemPrompt: `${current}\n\n${guidance}`,
    };
  });

  // Fase 7: comandos slash e UX
  registerCodegraphStatusCommand(pi);
  registerCodegraphInitCommand(pi);
  registerCodegraphIndexCommand(pi);
  registerCodegraphSyncCommand(pi);
  registerCodegraphToggleCommand(pi);
  registerSessionStartStatus(pi);
}
