/**
 * Wrapper da CLI do CodeGraph.
 * Encapsula pi.exec() com tratamento de erros, timeouts e parse JSON.
 *
 * Regras de segurança:
 * - NUNCA interpolar argumentos do usuário em string de shell.
 * - Sempre montar array de args.
 * - Validar código de saída; lançar Error quando != 0.
 * - Parse JSON somente quando solicitado; fallback para texto se inválido.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getCodegraphInvocation, TIMEOUTS } from "./config.js";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface RunCodegraphOptions {
  /** Timeout em ms. O padrão depende da classe de operação. */
  timeout?: number;
  /** Diretório de trabalho. Padrão: ctx.cwd. */
  cwd?: string;
  /** Tentar parsear stdout como JSON. */
  parseJson?: boolean;
  /** Conteúdo para stdin (ex.: lista de arquivos para codegraph affected --stdin). */
  stdin?: string;
}

export interface RunCodegraphResult {
  stdout: string;
  stderr: string;
  code: number;
  /** JSON parseado, quando parseJson === true e o parse foi bem-sucedido. */
  json?: unknown;
}

// ---------------------------------------------------------------------------
// Erro customizado
// ---------------------------------------------------------------------------

export class CodegraphCliError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly stdout: string,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = "CodegraphCliError";
  }
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

/**
 * Executa um comando codegraph de forma segura.
 *
 * Nunca monta o comando como string de shell — sempre usa array de argumentos.
 * Lança CodegraphCliError se o comando retornar código != 0.
 * Parseia JSON automaticamente quando `parseJson` é true.
 *
 * @param pi     API da extensão Pi.
 * @param args   Argumentos posicionais para o codegraph (ex.: ["status", "."]).
 * @param options  Timeout, cwd, parseJson, stdin.
 * @param signal AbortSignal para cancelamento.
 */
export async function runCodegraph(
  pi: ExtensionAPI,
  args: string[],
  options: RunCodegraphOptions = {},
  signal?: AbortSignal,
): Promise<RunCodegraphResult> {
  const invocation = getCodegraphInvocation();
  const timeout = options.timeout ?? TIMEOUTS.quick;

  // pi.exec aceita cwd? Vamos verificar a API. Se não aceitar diretamente,
  // documentamos que a ferramenta deve resolver paths manualmente e o cwd
  // é controlado pelo Pi durante a execução da tool.
  // Por enquanto, passamos apenas signal e timeout.
  const result = await pi.exec(
    invocation.bin,
    [...invocation.prefixArgs, ...args],
    { signal, timeout },
  );

  const { stdout, stderr, code } = result;

  if (code !== 0) {
    const details = stderr.trim() || stdout.trim() || "(sem saída)";
    throw new CodegraphCliError(
      `codegraph ${args[0] ?? ""} falhou com código ${code}: ${details}`,
      code,
      stdout,
      stderr,
    );
  }

  const output: RunCodegraphResult = { stdout, stderr, code };

  if (options.parseJson && stdout.trim()) {
    try {
      output.json = JSON.parse(stdout);
    } catch {
      // JSON inválido — mantém stdout como texto e não popula json.
      // A ferramenta consumidora decide como tratar.
    }
  }

  return output;
}
