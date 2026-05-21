/**
 * Configuração da extensão.
 * Resolve o binário do CodeGraph e timeouts padrão.
 */

/** Caminho para o binário codegraph. Respeita PI_CODEGRAPH_BIN, fallback para "codegraph". */
export function getCodegraphBin(): string {
  return process.env.PI_CODEGRAPH_BIN || "codegraph";
}

/** Timeouts padrão por classe de operação (ms). */
export const TIMEOUTS = {
  /** status, files, search — consultas leves */
  quick: 20_000,
  /** context, affected, sync — consultas mais pesadas */
  query: 30_000,
  /** init, index — operações de longa duração */
  indexing: 10 * 60_000,
} as const;
