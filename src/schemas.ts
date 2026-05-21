/**
 * Schemas typebox para validação de parâmetros das ferramentas CodeGraph
 * e builders puros que convertem parâmetros validados em arrays de argumentos CLI.
 *
 * Regras dos builders:
 * - NUNCA retornam string de shell — sempre string[].
 * - Flags booleanas só aparecem quando true.
 * - Valores undefined/null são omitidos.
 * - Ordem: comando, subcomando, argumentos posicionais, flags.
 */

import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";

// ---------------------------------------------------------------------------
// Schemas TypeBox — parâmetros validados pelo Pi antes do execute()
// ---------------------------------------------------------------------------

/** Formato de saída aceito por codegraph context e codegraph files. */
const FormatEnum = StringEnum(["markdown", "json", "text"] as const);

// --- Status ---

export const CodegraphStatusParams = Type.Object({
  /** Caminho do projeto. Padrão: ctx.cwd. */
  path: Type.Optional(Type.String({ description: "Project path (default: current directory)" })),
});

// ---------------------------------------------------------------------------
// Tipos de entrada (usados pelos builders; refletem os schemas acima)
// ---------------------------------------------------------------------------

export interface CodegraphStatusInput { path?: string }
export interface CodegraphInitInput { path?: string; index?: boolean; interactive?: boolean }
export interface CodegraphIndexInput { path?: string; force?: boolean; quiet?: boolean }
export interface CodegraphSyncInput { path?: string; quiet?: boolean }
export interface CodegraphSearchInput { query: string; kind?: string; limit?: number; path?: string }
export interface CodegraphFilesInput { path?: string; format?: string; filter?: string; maxDepth?: number }
export interface CodegraphContextInput { task: string; path?: string; format?: string; maxNodes?: number }
export interface CodegraphAffectedInput { files?: string[]; stdin?: string; depth?: number; filter?: string; json?: boolean; quiet?: boolean }

// --- Init ---

export const CodegraphInitParams = Type.Object({
  path: Type.Optional(Type.String({ description: "Project path (default: current directory)" })),
  /** Also index after init. */
  index: Type.Optional(Type.Boolean({ description: "Also index after initialization" })),
  /** Run interactive mode. Should be false for LLM tools by default. */
  interactive: Type.Optional(Type.Boolean({ description: "Run interactive installer (default: false)" })),
});

// --- Index ---

export const CodegraphIndexParams = Type.Object({
  path: Type.Optional(Type.String({ description: "Project path (default: current directory)" })),
  /** Force re-index even if up to date. */
  force: Type.Optional(Type.Boolean({ description: "Force re-index even if up to date" })),
  /** Suppress progress output. */
  quiet: Type.Optional(Type.Boolean({ description: "Suppress progress output" })),
});

// --- Sync ---

export const CodegraphSyncParams = Type.Object({
  path: Type.Optional(Type.String({ description: "Project path (default: current directory)" })),
  quiet: Type.Optional(Type.Boolean({ description: "Suppress progress output" })),
});

// --- Search ---

export const CodegraphSearchParams = Type.Object({
  /** Texto de busca (nome de símbolo, função, classe, etc.). */
  query: Type.String({ description: "Symbol name or text to search for" }),
  /** Filtrar por tipo de nó (ex.: function, class, method). */
  kind: Type.Optional(Type.String({ description: "Filter by node kind (e.g., function, class, method)" })),
  /** Máximo de resultados. */
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, description: "Maximum results (1-100)" })),
  path: Type.Optional(Type.String({ description: "Project path (default: current directory)" })),
});

// --- Files ---

export const CodegraphFilesParams = Type.Object({
  path: Type.Optional(Type.String({ description: "Project path (default: current directory)" })),
  /** Output format. */
  format: Type.Optional(FormatEnum),
  /** Glob pattern to filter files. */
  filter: Type.Optional(Type.String({ description: "Glob pattern to filter files (e.g., 'src/**')" })),
  /** Maximum directory depth. */
  maxDepth: Type.Optional(Type.Number({ minimum: 1, maximum: 50, description: "Maximum directory depth" })),
});

// --- Context ---

export const CodegraphContextParams = Type.Object({
  /** Descrição da tarefa para a qual o contexto será construído. */
  task: Type.String({ description: "Task description for context building" }),
  path: Type.Optional(Type.String({ description: "Project path (default: current directory)" })),
  /** Output format. */
  format: Type.Optional(FormatEnum),
  /** Máximo de nós incluídos no contexto. */
  maxNodes: Type.Optional(Type.Number({ minimum: 1, maximum: 100, description: "Maximum nodes in context (1-100)" })),
});

// --- Affected ---

export const CodegraphAffectedParams = Type.Object({
  /** Lista de arquivos alterados. */
  files: Type.Optional(Type.Array(Type.String(), { description: "List of changed files" })),
  /** String para stdin (alternativa a files, para pipe). */
  stdin: Type.Optional(Type.String({ description: "File list as newline-separated string for stdin" })),
  /** Profundidade máxima de dependências. */
  depth: Type.Optional(Type.Number({ minimum: 1, maximum: 20, description: "Max dependency traversal depth (1-20)" })),
  /** Glob para identificar arquivos de teste. */
  filter: Type.Optional(Type.String({ description: "Glob to identify test files" })),
  /** Saída como JSON. */
  json: Type.Optional(Type.Boolean({ description: "Output as JSON" })),
  /** Apenas paths na saída. */
  quiet: Type.Optional(Type.Boolean({ description: "Output only file paths" })),
});

// ---------------------------------------------------------------------------
// Helpers para builders
// ---------------------------------------------------------------------------

/** Adiciona um valor opcional como "--flag value". */
function flag(args: string[], name: string, value: string | number | undefined): void {
  if (value !== undefined && value !== null) {
    args.push(name, String(value));
  }
}

/** Adiciona uma flag booleana como "--flag" se o valor for true. */
function boolFlag(args: string[], name: string, value: boolean | undefined): void {
  if (value === true) args.push(name);
}

/** Resolve caminho opcional: se existir, usa; senão, omite. */
function optPath(args: string[], path: string | undefined): void {
  if (path !== undefined && path !== null && path.length > 0) {
    args.push(path);
  }
}

// ---------------------------------------------------------------------------
// Builders de argumentos CLI
// ---------------------------------------------------------------------------

export function buildStatusArgs(params: CodegraphStatusInput): string[] {
  const args = ["status"];
  optPath(args, params.path);
  return args;
}

export function buildInitArgs(params: CodegraphInitInput): string[] {
  const args = ["init"];
  optPath(args, params.path);
  boolFlag(args, "--index", params.index);
  // interactive: sem flag explícita; a CLI usa por padrão, mas tools LLM devem ser não-interativas.
  // Se explicitamente definido como false, podemos pular, pois o padrão da CLI pode ser interativo.
  // Por segurança, se não for explicitamente true, não passamos nada (deixamos o default da CLI).
  if (params.interactive === true) {
    // Modo interativo — normalmente não usado por LLM.
    // A CLI pode não ter flag para isso, mas documentamos.
  }
  return args;
}

export function buildIndexArgs(params: CodegraphIndexInput): string[] {
  const args = ["index"];
  optPath(args, params.path);
  boolFlag(args, "--force", params.force);
  boolFlag(args, "--quiet", params.quiet);
  return args;
}

export function buildSyncArgs(params: CodegraphSyncInput): string[] {
  const args = ["sync"];
  optPath(args, params.path);
  boolFlag(args, "--quiet", params.quiet);
  return args;
}

export function buildSearchArgs(params: CodegraphSearchInput): string[] {
  const args = ["query", params.query];
  flag(args, "--kind", params.kind);
  flag(args, "--limit", params.limit);
  args.push("--json");
  optPath(args, params.path);
  return args;
}

export function buildFilesArgs(params: CodegraphFilesInput): string[] {
  const args = ["files"];
  optPath(args, params.path);
  flag(args, "--format", params.format);
  flag(args, "--filter", params.filter);
  flag(args, "--max-depth", params.maxDepth);
  args.push("--json");
  return args;
}

export function buildContextArgs(params: CodegraphContextInput): string[] {
  const args = ["context", params.task];
  optPath(args, params.path);
  flag(args, "--format", params.format);
  flag(args, "--max-nodes", params.maxNodes);
  return args;
}

export function buildAffectedArgs(params: CodegraphAffectedInput): string[] {
  const args = ["affected"];

  if (params.files && params.files.length > 0) {
    args.push(...params.files);
  } else if (params.stdin) {
    args.push("--stdin");
  }

  flag(args, "--depth", params.depth);
  flag(args, "--filter", params.filter);
  boolFlag(args, "--json", params.json);
  boolFlag(args, "--quiet", params.quiet);

  return args;
}
