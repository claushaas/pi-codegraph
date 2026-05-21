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

/**
 * Ponto de entrada da extensão.
 *
 * Ferramentas e comandos serão registrados nas fases seguintes (Fase 5–7 do ROADMAP).
 */
export default function piCodegraph(_pi: ExtensionAPI): void {
  // Fase 5: registrar ferramentas (codegraph_status, codegraph_search, etc.)
  // Fase 6: adicionar hook before_agent_start para orientação contextual
  // Fase 7: registrar comandos slash (/codegraph-status, /codegraph-init, /codegraph-index)
}
