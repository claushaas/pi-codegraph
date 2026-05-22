/**
 * Configuração da extensão.
 * Resolve o binário do CodeGraph e timeouts padrão.
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export interface CodegraphInvocation {
  /** Executável passado para pi.exec(). */
  bin: string;
  /** Argumentos que devem preceder os argumentos reais da CLI CodeGraph. */
  prefixArgs: string[];
}

function resolveBundledCodegraphCli(): string | undefined {
  try {
    return require.resolve("@colbymchenry/codegraph/dist/bin/codegraph.js");
  } catch {
    return undefined;
  }
}

/** Caminho para a CLI codegraph. Para executar via pi.exec(), prefira getCodegraphInvocation(). */
export function getCodegraphBin(): string {
  return (
    process.env.PI_CODEGRAPH_BIN || resolveBundledCodegraphCli() || "codegraph"
  );
}

/** Invocação portátil: executa a CLI JS empacotada via o Node atual quando ela estiver disponível. */
export function getCodegraphInvocation(): CodegraphInvocation {
  const configuredBin = process.env.PI_CODEGRAPH_BIN;
  if (configuredBin) {
    return { bin: configuredBin, prefixArgs: [] };
  }

  const bundledCli = resolveBundledCodegraphCli();
  if (bundledCli) {
    return { bin: process.execPath, prefixArgs: [bundledCli] };
  }

  return { bin: "codegraph", prefixArgs: [] };
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
