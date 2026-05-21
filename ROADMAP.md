# ROADMAP — implementação da extensão `pi-codegraph`

Este roadmap parte do estado atual do repositório, onde existe apenas `SPEC.md`, e conduz até uma extensão Pi pronta para uso local, testada e preparada para publicação futura no npm.

## Estado atual

- Diretório atual: pacote ainda não inicializado.
- Artefato existente: `SPEC.md`.
- Ainda não existem:
  - `package.json`
  - `index.ts`
  - `README.md`
  - `src/`
  - testes
  - ferramentas registradas no Pi

## Objetivo final

Entregar uma extensão Pi carregável por:

```bash
pi -e .
```

Com ferramentas CodeGraph registradas via `pi.registerTool()`, comandos slash para UX básica, execução via CLI `codegraph`, testes automatizados e documentação mínima para instalação futura via npm.

---

## Fase 0 — Alinhar decisões técnicas iniciais

### Tarefas

1. Confirmar o nome inicial do pacote:
   - padrão recomendado: `pi-codegraph`.
2. Confirmar estratégia do binário CodeGraph:
   - inicial: usar `@colbymchenry/codegraph` em `dependencies`;
   - também suportar, futuramente, override via `PI_CODEGRAPH_BIN`.
3. Confirmar que a integração inicial será **somente CLI**, sem MCP.
4. Manter fora do escopo inicial:
   - `codegraph serve --mcp`;
   - integração com configs Claude/Cursor/Codex/opencode;
   - ferramentas MCP sem equivalente CLI público documentado.

### Entregáveis

- Decisões refletidas em `package.json`, `README.md` e comentários de implementação.

### Critério de conclusão

- Nenhuma implementação depende de MCP.
- O pacote assume `codegraph` como CLI executável e documenta como diagnosticar ausência do binário.

---

## Fase 1 — Criar esqueleto do pacote npm

### Tarefas

1. Criar `package.json` com manifesto Pi:

```json
{
  "name": "pi-codegraph",
  "version": "0.1.0",
  "type": "module",
  "description": "Pi coding agent extension for CodeGraph CLI integration",
  "keywords": ["pi-package", "pi-extension", "codegraph"],
  "license": "MIT",
  "pi": {
    "extensions": ["./index.ts"]
  },
  "scripts": {
    "check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "echo 'pi loads TypeScript extensions via jiti'",
    "pack:dry": "npm pack --dry-run"
  },
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-ai": "*",
    "typebox": "*"
  },
  "dependencies": {
    "@colbymchenry/codegraph": "^0.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^3.0.0"
  }
}
```

2. Criar `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["index.ts", "src/**/*.ts", "test/**/*.ts"]
}
```

3. Criar estrutura:

```text
.
├── package.json
├── tsconfig.json
├── README.md
├── SPEC.md
├── ROADMAP.md
├── index.ts
├── src/
│   ├── cli.ts
│   ├── config.ts
│   ├── schemas.ts
│   ├── truncate.ts
│   └── tools/
│       ├── affected.ts
│       ├── context.ts
│       ├── files.ts
│       ├── init.ts
│       ├── index.ts
│       ├── search.ts
│       ├── status.ts
│       └── sync.ts
└── test/
    ├── cli.test.ts
    ├── truncate.test.ts
    ├── schemas.test.ts
    └── tools.test.ts
```

4. Criar `index.ts` mínimo:

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function piCodegraph(pi: ExtensionAPI) {
  // Ferramentas e comandos serão registrados nas próximas fases.
}
```

5. Rodar:

```bash
npm install
npm run check
```

### Entregáveis

- Pacote npm inicial.
- Extensão vazia, mas carregável.

### Critério de conclusão

- `npm install` conclui.
- `npm run check` conclui.
- `pi -e .` não falha por ausência de manifesto ou entrada da extensão.

---

## Fase 2 — Implementar configuração e wrapper da CLI

### Arquivos

- `src/config.ts`
- `src/cli.ts`
- `test/cli.test.ts`

### Tarefas

1. Implementar resolução do binário:

```ts
export function getCodegraphBin(): string {
  return process.env.PI_CODEGRAPH_BIN || "codegraph";
}
```

2. Definir tipos de execução:

```ts
export interface RunCodegraphOptions {
  timeout?: number;
  cwd?: string;
  parseJson?: boolean;
  stdin?: string;
}

export interface RunCodegraphResult {
  stdout: string;
  stderr: string;
  code: number;
  json?: unknown;
}
```

3. Implementar função central:

```ts
export async function runCodegraph(
  pi: ExtensionAPI,
  args: string[],
  options: RunCodegraphOptions,
  signal?: AbortSignal,
): Promise<RunCodegraphResult>;
```

4. Regras obrigatórias:
   - usar `pi.exec(getCodegraphBin(), args, { signal, timeout })`;
   - nunca montar comando como string de shell;
   - não interpolar argumento do usuário;
   - lançar `Error` quando `code !== 0`;
   - incluir `stderr` na mensagem de erro quando existir;
   - parsear JSON somente quando `parseJson` for verdadeiro;
   - fallback para texto quando JSON vier inválido, se o comando permitir fallback.

5. Definir timeouts padrão:

```ts
export const TIMEOUTS = {
  quick: 20_000,
  query: 30_000,
  indexing: 10 * 60_000,
};
```

6. Testes unitários:
   - chama `pi.exec` com binário e args separados;
   - respeita `PI_CODEGRAPH_BIN`;
   - lança erro quando `code !== 0`;
   - parseia JSON válido;
   - preserva stdout quando JSON inválido em fallback;
   - passa `signal` e `timeout`.

### Entregáveis

- Wrapper CLI centralizado.
- Testes unitários do wrapper.

### Critério de conclusão

- Nenhuma ferramenta futura chama `pi.exec` diretamente; todas usam `runCodegraph`.
- `npm test -- cli.test.ts` passa.

---

## Fase 3 — Implementar truncamento e segurança de saída

### Arquivos

- `src/truncate.ts`
- `test/truncate.test.ts`

### Tarefas

1. Importar utilitários do Pi:

```ts
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,
  truncateTail,
} from "@earendil-works/pi-coding-agent";
```

2. Criar helper para saídas de ferramentas:

```ts
export function formatToolOutput(
  output: string,
  options?: { mode?: "head" | "tail"; label?: string },
): {
  text: string;
  details: {
    truncated: boolean;
    totalLines?: number;
    outputLines?: number;
    totalBytes?: number;
    outputBytes?: number;
  };
};
```

3. Política recomendada:
   - `truncateHead` para `search`, `files`, `context` e outputs estruturais;
   - `truncateTail` para logs de `index`, `sync`, `init`.

4. Documentar no texto da ferramenta:
   - limite de 50KB;
   - limite de 2000 linhas;
   - aviso quando houver truncamento.

5. Testes:
   - saída pequena não trunca;
   - saída acima de linhas trunca;
   - saída acima de bytes trunca;
   - mensagem final informa truncamento.

### Entregáveis

- Helper de truncamento reutilizável.

### Critério de conclusão

- Toda tool retorna `content` com saída truncada.
- Metadata de truncamento aparece em `details`.

---

## Fase 4 — Implementar schemas e builders de argumentos

### Arquivos

- `src/schemas.ts`
- `test/schemas.test.ts`

### Tarefas

1. Definir schemas `typebox` para cada ferramenta:
   - `CodegraphStatusParams`
   - `CodegraphInitParams`
   - `CodegraphIndexParams`
   - `CodegraphSyncParams`
   - `CodegraphSearchParams`
   - `CodegraphFilesParams`
   - `CodegraphContextParams`
   - `CodegraphAffectedParams`

2. Usar `StringEnum` de `@earendil-works/pi-ai` para enums:

```ts
import { StringEnum } from "@earendil-works/pi-ai";
```

3. Criar builders puros para argumentos CLI, por exemplo:

```ts
export function buildSearchArgs(params: CodegraphSearchInput): string[] {
  const args = ["query", params.query, "--json"];
  if (params.kind) args.push("--kind", params.kind);
  if (params.limit) args.push("--limit", String(params.limit));
  if (params.path) args.push(params.path);
  return args;
}
```

4. Validar limites:
   - `limit`: mínimo 1, máximo razoável, ex. 100;
   - `maxNodes`: mínimo 1, máximo razoável, ex. 100;
   - `depth`: mínimo 1, máximo 20.

5. Testes:
   - builders geram arrays corretos;
   - flags booleanas aparecem apenas quando verdadeiras;
   - nenhum builder retorna string de shell;
   - enums aceitam valores esperados.

### Entregáveis

- Schemas e builders testáveis sem Pi.

### Critério de conclusão

- Ferramentas usam schemas compartilhados.
- Builders têm cobertura unitária.

---

## Fase 5 — Implementar ferramentas Pi

### Arquivos

- `src/tools/status.ts`
- `src/tools/init.ts`
- `src/tools/index.ts`
- `src/tools/sync.ts`
- `src/tools/search.ts`
- `src/tools/files.ts`
- `src/tools/context.ts`
- `src/tools/affected.ts`
- `index.ts`
- `test/tools.test.ts`

### Padrão de implementação

Cada arquivo deve exportar uma função de registro ou factory:

```ts
export function registerCodegraphStatusTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "codegraph_status",
    label: "CodeGraph Status",
    description: "Check CodeGraph index health and project statistics.",
    promptSnippet: "Check CodeGraph index status for the current project",
    promptGuidelines: [
      "Use codegraph_status when you need to know whether CodeGraph is initialized before code exploration."
    ],
    parameters: CodegraphStatusParams,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      // runCodegraph(...)
    },
  });
}
```

### Ferramentas e comandos CLI

| Tool Pi | CLI | Timeout | JSON preferido |
|---|---|---:|---|
| `codegraph_status` | `codegraph status [path]` | quick | quando disponível |
| `codegraph_init` | `codegraph init [path]` | indexing | não necessariamente |
| `codegraph_index` | `codegraph index [path]` | indexing | não necessariamente |
| `codegraph_sync` | `codegraph sync [path]` | indexing/query | não necessariamente |
| `codegraph_search` | `codegraph query <query> --json` | query | sim |
| `codegraph_files` | `codegraph files [path] --json` | quick | sim |
| `codegraph_context` | `codegraph context <task>` | query | se formato `json` |
| `codegraph_affected` | `codegraph affected ...` | query | sim quando `json` |

### Tarefas por ferramenta

1. `codegraph_status`
   - aceitar `path?`;
   - rodar status;
   - retornar resumo textual e `details` com JSON quando disponível.

2. `codegraph_init`
   - aceitar `path?`, `index?`, `interactive?`;
   - padrão: não interativo;
   - se `index` for true, adicionar flag apropriada se suportada pela CLI ou orientar uso posterior de `codegraph_index`.

3. `codegraph_index`
   - aceitar `force?`, `quiet?`, `path?`;
   - truncar logs pelo final (`tail`).

4. `codegraph_sync`
   - aceitar `quiet?`, `path?`;
   - truncar logs pelo final.

5. `codegraph_search`
   - aceitar `query`, `kind?`, `limit?`, `path?`;
   - usar `--json`;
   - retornar lista resumida de símbolos.

6. `codegraph_files`
   - aceitar `path?`, `format?`, `filter?`, `maxDepth?`;
   - usar `--json` quando aplicável;
   - retornar árvore/lista truncada.

7. `codegraph_context`
   - aceitar `task`, `format?`, `maxNodes?`, `path?`;
   - avisar no prompt/description que pode retornar código;
   - truncar rigorosamente.

8. `codegraph_affected`
   - aceitar `files?`, `stdin?`, `depth?`, `filter?`, `json?`, `quiet?`;
   - para stdin, verificar se `pi.exec` suporta stdin; se não suportar inicialmente, começar apenas com `files[]` e registrar TODO claro.

### Registro no `index.ts`

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerCodegraphStatusTool } from "./src/tools/status.js";
// ...demais imports

export default function piCodegraph(pi: ExtensionAPI) {
  registerCodegraphStatusTool(pi);
  // ...demais tools
}
```

### Testes

- Mockar `pi.registerTool` e verificar nomes registrados.
- Executar `execute` com `pi.exec` mockado.
- Validar erro quando CLI retorna código diferente de zero.
- Validar truncamento aplicado.

### Entregáveis

- Oito ferramentas registradas.

### Critério de conclusão

- Todas as ferramentas aparecem no Pi.
- Todas passam por `runCodegraph`.
- Todas retornam `{ content, details }`.

---

## Fase 6 — Orientação ativa do agente

### Arquivos

- `index.ts`
- possivelmente `src/guidance.ts`

### Tarefas

1. Adicionar `promptSnippet` e `promptGuidelines` a todas as ferramentas.
2. Implementar detecção de `.codegraph/`:

```ts
import { access } from "node:fs/promises";
import { join } from "node:path";

async function hasCodegraph(cwd: string): Promise<boolean> {
  try {
    await access(join(cwd, ".codegraph"));
    return true;
  } catch {
    return false;
  }
}
```

3. Adicionar hook `before_agent_start`:

```ts
pi.on("before_agent_start", async (_event, ctx) => {
  if (await hasCodegraph(ctx.cwd)) {
    return {
      systemPrompt: `${ctx.getSystemPrompt()}\n\n${CODEGRAPH_READY_GUIDANCE}`,
    };
  }
});
```

4. Orientação quando `.codegraph/` existe:
   - preferir `codegraph_search` para localizar símbolos;
   - preferir `codegraph_context` para arquitetura/fluxo;
   - preferir `codegraph_files` para estrutura indexada;
   - usar `read` depois, para confirmação exata antes de editar.

5. Orientação quando `.codegraph/` não existe:
   - não bloquear;
   - sugerir `codegraph_init` para explorações amplas.

6. Não implementar bloqueio de `grep/read/find` nesta fase.

### Testes

- Unit test de `hasCodegraph` com diretório temporário.
- Teste de string de guidance.
- Teste do hook pode ser manual se o harness de eventos do Pi não for simples de mockar.

### Entregáveis

- Agente passa a receber orientação contextual.

### Critério de conclusão

- Em projeto com `.codegraph/`, o system prompt instrui o uso preferencial de `codegraph_*` para exploração.
- Em projeto sem `.codegraph/`, não há bloqueio nem ruído excessivo.

---

## Fase 7 — Comandos slash e UX

### Arquivos

- `index.ts`
- possivelmente `src/commands.ts`

### Tarefas

1. Registrar `/codegraph-status`:
   - roda `codegraph status` no `ctx.cwd`;
   - exibe `ctx.ui.notify` com resumo;
   - em modo sem UI, apenas retorna silenciosamente/loga se necessário.

2. Registrar `/codegraph-init`:
   - confirmar com `ctx.ui.confirm` antes de inicializar;
   - rodar `codegraph init`;
   - oferecer indexação em seguida, se fizer sentido.

3. Registrar `/codegraph-index`:
   - confirmar, pois pode demorar;
   - rodar `codegraph index`;
   - notificar sucesso/falha.

4. Em `session_start`:
   - se `.codegraph/` existe, opcionalmente `ctx.ui.setStatus("codegraph", "CodeGraph: ready")`;
   - se não existe, opcionalmente notificar uma vez por sessão, sem interromper.

5. Tratar `ctx.hasUI`:
   - só usar `confirm`, `notify`, `setStatus` quando apropriado.

### Testes

- Mockar `pi.registerCommand` e verificar comandos registrados.
- Testar handlers com `ctx.ui` mockado.
- Testar caminho de cancelamento no confirm.

### Entregáveis

- UX humana mínima.

### Critério de conclusão

- Usuário consegue inicializar e checar CodeGraph por slash commands.
- Comandos não quebram em modos sem UI.

---

## Fase 8 — Testes automatizados completos

### Framework

Usar `vitest`.

### Tarefas

1. Criar mocks utilitários:

```ts
function createMockPi() {
  return {
    exec: vi.fn(),
    registerTool: vi.fn(),
    registerCommand: vi.fn(),
    on: vi.fn(),
  } as unknown as ExtensionAPI;
}
```

2. Cobrir unidades puras:
   - builders de argumentos;
   - truncamento;
   - parse JSON;
   - mensagens de erro;
   - resolução de binário;
   - detecção `.codegraph/`.

3. Cobrir ferramentas:
   - registro de cada tool;
   - chamada correta de CLI;
   - retorno correto em sucesso;
   - erro correto em falha;
   - truncamento em output grande.

4. Cobrir comandos:
   - `/codegraph-status` chama status;
   - `/codegraph-init` respeita confirmação;
   - `/codegraph-index` respeita confirmação.

5. Cobrir guidance:
   - texto de orientação contém nomes das ferramentas;
   - não recomenda MCP;
   - diferencia projeto com/sem `.codegraph/`.

### Testes manuais/smoke

Executar em um projeto temporário sem `.codegraph/`:

```bash
mkdir -p /tmp/pi-codegraph-smoke-empty
cd /tmp/pi-codegraph-smoke-empty
pi -e /Users/claus/.pi/agent/extensions/pi-codegraph
```

Validar:

- extensão carrega;
- ferramentas aparecem;
- `codegraph_status` falha de forma compreensível ou informa ausência de índice;
- `/codegraph-init` está disponível.

Executar em projeto inicializado:

```bash
mkdir -p /tmp/pi-codegraph-smoke-project
cd /tmp/pi-codegraph-smoke-project
printf 'export function hello() { return "world"; }\n' > hello.ts
codegraph init .
codegraph index .
pi -e /Users/claus/.pi/agent/extensions/pi-codegraph
```

Validar via interação com o Pi:

- chamar `codegraph_status`;
- chamar `codegraph_search` com `hello`;
- chamar `codegraph_files`;
- chamar `codegraph_context` com “como hello funciona?”;
- garantir que nenhuma chamada MCP acontece.

### Entregáveis

- Suite `vitest`.
- Checklist manual de smoke tests documentado no README.

### Critério de conclusão

- `npm test` passa.
- Smoke test em projeto com e sem `.codegraph/` passa.

---

## Fase 9 — Validação local da extensão no Pi

### Tarefas

1. Rodar checks:

```bash
npm run check
npm test
npm run pack:dry
```

2. Rodar Pi com extensão local:

```bash
pi -e .
```

3. Verificar no Pi:
   - ferramentas registradas;
   - comandos slash registrados;
   - guidance não polui excessivamente o prompt;
   - erros são compreensíveis;
   - saídas longas são truncadas.

4. Testar cancelamento:
   - iniciar `codegraph_index` em projeto maior;
   - cancelar via Pi/Esc;
   - confirmar que o processo é interrompido ou que o erro é claro.

5. Testar ausência do binário:

```bash
PI_CODEGRAPH_BIN=/bin/nonexistent pi -e .
```

Validar mensagem:

- deve sugerir instalar `@colbymchenry/codegraph` ou ajustar `PI_CODEGRAPH_BIN`.

### Entregáveis

- Extensão validada localmente.

### Critério de conclusão

- Extensão utilizável em sessão real do Pi.

---

## Fase 10 — README e preparação npm

### Arquivos

- `README.md`
- `package.json`

### Tarefas

1. README deve conter:
   - o que é a extensão;
   - requisitos;
   - instalação local;
   - instalação futura via npm;
   - lista de ferramentas;
   - lista de comandos slash;
   - exemplos de uso;
   - troubleshooting.

2. Exemplo de instalação local:

```bash
cd ~/.pi/agent/extensions/pi-codegraph
npm install
pi -e .
```

3. Exemplo futuro:

```bash
pi install npm:pi-codegraph
```

4. Documentar variáveis:

```bash
PI_CODEGRAPH_BIN=/path/to/codegraph
```

5. Documentar troubleshooting:
   - CodeGraph não instalado;
   - projeto sem `.codegraph/`;
   - indexação lenta;
   - saída truncada;
   - backend SQLite WASM vs native, conforme docs do CodeGraph.

6. Validar pacote:

```bash
npm pack --dry-run
```

7. Conferir que o pacote inclui:
   - `package.json`;
   - `README.md`;
   - `index.ts`;
   - `src/**/*.ts`;
   - `SPEC.md` e `ROADMAP.md` se desejado.

### Entregáveis

- README pronto.
- Pacote pronto para publicação futura.

### Critério de conclusão

- `npm pack --dry-run` mostra somente arquivos esperados.
- README é suficiente para novo usuário instalar e testar.

---

## Ordem recomendada de implementação

1. Fase 1 — esqueleto npm.
2. Fase 2 — wrapper CLI.
3. Fase 3 — truncamento.
4. Fase 4 — schemas/builders.
5. Fase 5 — tools em ordem:
   1. `codegraph_status`
   2. `codegraph_search`
   3. `codegraph_files`
   4. `codegraph_context`
   5. `codegraph_init`
   6. `codegraph_index`
   7. `codegraph_sync`
   8. `codegraph_affected`
6. Fase 6 — guidance do agente.
7. Fase 7 — slash commands.
8. Fase 8 — testes completos.
9. Fase 9 — validação local.
10. Fase 10 — preparação npm.

---

## Definition of Done

A extensão estará pronta quando todos os itens abaixo forem verdadeiros:

- [ ] `pi -e .` carrega a extensão sem erros.
- [ ] `package.json` contém `pi.extensions: ["./index.ts"]`.
- [ ] Todas as ferramentas planejadas estão registradas:
  - [ ] `codegraph_status`
  - [ ] `codegraph_init`
  - [ ] `codegraph_index`
  - [ ] `codegraph_sync`
  - [ ] `codegraph_search`
  - [ ] `codegraph_files`
  - [ ] `codegraph_context`
  - [ ] `codegraph_affected`
- [ ] Comandos slash existem:
  - [ ] `/codegraph-status`
  - [ ] `/codegraph-init`
  - [ ] `/codegraph-index`
- [ ] Todas as execuções passam por `runCodegraph`.
- [ ] Nenhuma chamada MCP é feita.
- [ ] Saídas grandes são truncadas a 50KB/2000 linhas ou limite equivalente.
- [ ] Erros da CLI lançam `Error` em `execute`.
- [ ] O agente recebe orientação contextual para usar CodeGraph quando `.codegraph/` existe.
- [ ] Projeto sem `.codegraph/` tem erro/aviso compreensível.
- [ ] Projeto com `.codegraph/` permite status/search/files/context.
- [ ] `npm run check` passa.
- [ ] `npm test` passa.
- [ ] Smoke tests manuais passam.
- [ ] `npm pack --dry-run` mostra pacote publicável.
- [ ] README contém instalação, uso, ferramentas e troubleshooting.

---

## Riscos e mitigação

### CLI do CodeGraph muda ou flags não existem

Mitigação:

- centralizar builders em `src/schemas.ts`;
- cobrir builders por testes;
- manter fallback textual quando JSON não estiver disponível.

### `@colbymchenry/codegraph` como dependency não expõe binário como esperado

Mitigação:

- suportar `PI_CODEGRAPH_BIN` desde cedo;
- documentar instalação global alternativa:

```bash
npm install -g @colbymchenry/codegraph
```

### Saídas grandes ocupam contexto demais

Mitigação:

- truncar todas as saídas;
- preferir resumos no `content` e dados completos, se pequenos, em `details`;
- orientar o agente a fazer perguntas mais específicas.

### Agente continua usando grep/read antes de CodeGraph

Mitigação:

- usar `promptSnippet` e `promptGuidelines`;
- adicionar hook `before_agent_start` condicional;
- considerar modo forte opcional somente no futuro.

### Comandos de indexação demorados

Mitigação:

- timeouts maiores e configuráveis;
- uso de `signal`;
- slash commands com confirmação;
- logs truncados pelo final.

---

## Referências necessárias

### Projeto

- `SPEC.md` — especificação funcional e técnica desta extensão.
- `ROADMAP.md` — este plano de implementação.

### Pi coding agent

- Extensões Pi: `/opt/homebrew/Cellar/pi-coding-agent/0.75.3/libexec/lib/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`
  - `pi.registerTool()`
  - `pi.registerCommand()`
  - `pi.on("before_agent_start")`
  - `pi.exec()`
  - truncamento de outputs
- Pacotes Pi: `/opt/homebrew/Cellar/pi-coding-agent/0.75.3/libexec/lib/node_modules/@earendil-works/pi-coding-agent/docs/packages.md`
  - manifesto `pi` em `package.json`
  - `pi.extensions`
  - `peerDependencies` para pacotes Pi

### Exemplos Pi

- Dependências em pacote de extensão:
  - `/opt/homebrew/Cellar/pi-coding-agent/0.75.3/libexec/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/with-deps/package.json`
  - `/opt/homebrew/Cellar/pi-coding-agent/0.75.3/libexec/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/with-deps/index.ts`
- Truncamento de output:
  - `/opt/homebrew/Cellar/pi-coding-agent/0.75.3/libexec/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/truncated-tool.ts`
- Registro de ferramentas e prompt guidance:
  - `/opt/homebrew/Cellar/pi-coding-agent/0.75.3/libexec/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/dynamic-tools.ts`
- Comando que dispara ação por tool/follow-up:
  - `/opt/homebrew/Cellar/pi-coding-agent/0.75.3/libexec/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/reload-runtime.ts`

### CodeGraph

- Repositório e README: https://github.com/colbymchenry/codegraph
- Pacote npm: https://www.npmjs.com/package/@colbymchenry/codegraph
- Comandos CLI referenciados:
  - `codegraph init [path]`
  - `codegraph index [path]`
  - `codegraph sync [path]`
  - `codegraph status [path]`
  - `codegraph query <search>`
  - `codegraph files [path]`
  - `codegraph context <task>`
  - `codegraph affected [files...]`
