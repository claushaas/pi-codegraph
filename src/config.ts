/**
 * Configuração da extensão.
 * Resolve o binário do CodeGraph e timeouts padrão.
 * Implementação: Fase 2 do ROADMAP.
 */

export function getCodegraphBin(): string {
  return process.env.PI_CODEGRAPH_BIN || "codegraph";
}
