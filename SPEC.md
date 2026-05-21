# SPEC — pi-codegraph

## 1. Objetivo

Criar uma extensão do **pi coding agent** que integra o [CodeGraph](https://github.com/colbymchenry/codegraph) ao Pi por meio da **CLI** do CodeGraph.

A extensão deve nascer como um pacote publicável no npm, com `package.json` desde o início, e deve permitir que o Pi chame ferramentas sem depender da configuração MCP de outros agentes como Claude Code, Cursor, Codex CLI ou opencode.

### Princípios

- Integração via CLI (`codegraph ...`), não via MCP.
- API exposta ao Pi por `pi.registerTool()`.
- Saídas seguras para contexto: truncadas, estruturadas quando possível e com erros claros.
- Baixa surpresa: executar no `ctx.cwd` por padrão e aceitar caminhos explícitos quando necessário.

## 2. Escopo

### Incluído

- Criar pacote npm de extensão Pi.
- Registrar ferramentas customizadas do Pi para comandos CodeGraph disponíveis via CLI.
- Encapsular comandos:
  - `codegraph status`
  - `codegraph init`
  - `codegraph index`
  - `codegraph sync`
  - `codegraph query`
  - `codegraph files`
  - `codegraph context`
  - `codegraph affected`
- Criar comandos slash básicos para uso humano no Pi.
- Detectar projetos inicializados por presença de `.codegraph/`.
- Validar parâmetros com `typebox`.
- Usar `pi.exec()` para execução com `AbortSignal`, timeout e cwd controlado.
- Preferir flags JSON quando disponíveis (`--json`) e preservar fallback para texto.

### Fora do escopo inicial

As ferramentas MCP listadas pelo CodeGraph que não têm equivalente CLI público documentado ficam para fase futura:

- `codegraph_callers`
- `codegraph_callees`
- `codegraph_impact`
- `codegraph_node`

Se uma versão futura da CLI expuser comandos equivalentes, adicionaremos ferramentas Pi correspondentes.

## 3. Estrutura inicial do pacote

```text
.
├── package.json
├── SPEC.md
├── README.md
├── index.ts
└── src/
    ├── tools/
    │   ├── affected.ts
    │   ├── context.ts
    │   ├── files.ts
    │   ├── init.ts
    │   ├── index.ts
    │   ├── search.ts
    │   ├── status.ts
    │   └── sync.ts
    ├── cli.ts
    ├── schemas.ts
    └── truncate.ts
```

## 4. `package.json` esperado

O pacote deve ser carregável por `pi -e .` durante desenvolvimento e por `pi install npm:<pacote>` após publicação.

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
    "build": "echo 'pi loads TypeScript extensions via jiti'",
    "test": "echo 'TODO'"
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
    "typescript": "^5.0.0"
  }
}
```

### Decisão sobre a dependência do CodeGraph

Há duas opções aceitáveis:

1. **Empacotar/garantir CLI via dependency**: manter `@colbymchenry/codegraph` em `dependencies` para que o binário fique disponível após instalação do pacote.
2. **Usar binário externo no PATH**: remover essa dependência e documentar que o usuário deve instalar `codegraph` globalmente.

Decisão inicial recomendada: **usar `@colbymchenry/codegraph` em `dependencies`**, pois o objetivo é que a extensão funcione como pacote npm autossuficiente. Ainda assim, a implementação deve permitir configurar o binário por variável de ambiente no futuro, por exemplo `PI_CODEGRAPH_BIN`.

## 5. Ferramentas planejadas

### `codegraph_status`

Verifica saúde e estatísticas do índice.

- CLI: `codegraph status [path]`
- Parâmetros:
  - `path?: string`
  - `json?: boolean`
- Uso: diagnosticar se `.codegraph/` existe, backend SQLite, linguagens e contagem de nós/arestas.

### `codegraph_init`

Inicializa CodeGraph em um projeto.

- CLI: `codegraph init [path]`
- Parâmetros:
  - `path?: string`
  - `index?: boolean`
  - `interactive?: boolean`
- Regras:
  - Não usar modo interativo por padrão dentro de ferramenta LLM.
  - Para interação humana, preferir comando slash `/codegraph-init`.

### `codegraph_index`

Executa indexação completa.

- CLI: `codegraph index [path]`
- Parâmetros:
  - `path?: string`
  - `force?: boolean`
  - `quiet?: boolean`
- Timeout maior que ferramentas de consulta.

### `codegraph_sync`

Executa atualização incremental.

- CLI: `codegraph sync [path]`
- Parâmetros:
  - `path?: string`
  - `quiet?: boolean`

### `codegraph_search`

Pesquisa símbolos por nome/texto.

- CLI: `codegraph query <search> --json`
- Parâmetros:
  - `query: string`
  - `kind?: string`
  - `limit?: number`
  - `path?: string`
- Nome da ferramenta Pi: `codegraph_search`, para alinhar com a nomenclatura MCP documentada.

### `codegraph_files`

Lista estrutura de arquivos indexada.

- CLI: `codegraph files [path] --json`
- Parâmetros:
  - `path?: string`
  - `format?: string`
  - `filter?: string`
  - `maxDepth?: number`

### `codegraph_context`

Constrói contexto relevante para uma tarefa.

- CLI: `codegraph context <task>`
- Parâmetros:
  - `task: string`
  - `path?: string`
  - `format?: "markdown" | "json" | "text"`
  - `maxNodes?: number`
- Atenção: esta ferramenta pode retornar bastante código. Deve truncar com rigor e orientar o modelo a pedir contexto mais específico quando necessário.

### `codegraph_affected`

Encontra testes/arquivos afetados por mudanças.

- CLI:
  - `codegraph affected <files...>`
  - ou `codegraph affected --stdin`
- Parâmetros:
  - `files?: string[]`
  - `stdin?: string[]`
  - `depth?: number`
  - `filter?: string`
  - `json?: boolean`
  - `quiet?: boolean`

## 6. Regras de execução

- Usar `pi.exec(command, args, { signal, timeout })`.
- O comando padrão é `codegraph`; no futuro poderá vir de configuração/env.
- Resolver paths relativos a `ctx.cwd`.
- Não interpolar argumentos em shell string; sempre montar array de args.
- Preferir `--json` quando o comando suportar.
- Parsear JSON quando possível e retornar dados em `details`.
- Retornar texto resumido em `content` para o LLM.
- Truncar todas as saídas com limite equivalente ao Pi:
  - 50KB; ou
  - 2000 linhas;
  - o que ocorrer primeiro.
- Em caso de truncamento, informar isso no `content` e registrar metadados em `details`.
- Se a CLI retornar código diferente de zero, lançar `Error` no `execute` da ferramenta.
- Respeitar cancelamento via `signal`.
- Usar timeouts diferentes por classe:
  - consultas: 15–30s;
  - status/files/search: 10–20s;
  - index/init: 2–10min, configurável.

## 7. UX no Pi

### Comandos slash

- `/codegraph-status`
  - Executa status do projeto atual e exibe notificação/resumo.
- `/codegraph-init`
  - Fluxo humano para inicializar projeto.
  - Pode confirmar antes de executar `codegraph init`.
- `/codegraph-index`
  - Executa indexação com confirmação, pois pode demorar.

### Notificações opcionais

No `session_start`:

- Se `.codegraph/` existir: mostrar status discreto ou footer opcional `CodeGraph: ready`.
- Se `.codegraph/` não existir: não interromper; opcionalmente notificar uma vez por sessão que `/codegraph-init` está disponível.

### Prompt guidance

As ferramentas devem usar `promptSnippet` e `promptGuidelines` para orientar o modelo:

- Usar `codegraph_search` antes de grep/read quando o projeto tiver `.codegraph/`.
- Usar `codegraph_context` para entender áreas amplas, mas evitar chamadas genéricas demais.
- Usar `codegraph_affected` antes de escolher testes relacionados a mudanças.
- Não depender de MCP nem de arquivos de configuração de outros agentes.

## 8. Orientação de uso pelo agente

A extensão não deve depender apenas da existência das ferramentas. O agente precisa receber orientação explícita para preferir CodeGraph quando isso fizer sentido.

### Nível 1 — Orientação suave por ferramenta

Cada ferramenta registrada com `pi.registerTool()` deve definir:

- `description`: explicação objetiva do que a ferramenta faz.
- `promptSnippet`: resumo curto para aparecer em “Available tools”.
- `promptGuidelines`: instruções explícitas nomeando a ferramenta.

Exemplos de guidelines:

- Use `codegraph_search` antes de `grep`, `find` ou leitura manual quando precisar localizar símbolos, funções, classes, rotas ou módulos em um projeto com `.codegraph/`.
- Use `codegraph_context` para perguntas de arquitetura, fluxo de execução, entendimento de subsistemas ou investigação inicial ampla.
- Use `codegraph_files` para obter a estrutura indexada antes de listar diretórios manualmente em projetos grandes.
- Use `codegraph_affected` antes de escolher testes relacionados a arquivos alterados.
- Use `read` depois do CodeGraph quando precisar confirmar conteúdo exato antes de editar.

### Nível 2 — Orientação contextual por sessão

A extensão deve considerar um hook `before_agent_start` para injetar instruções no system prompt quando o projeto atual tiver `.codegraph/`.

Instrução sugerida:

```markdown
Este projeto tem CodeGraph inicializado. Para exploração de código, localização de símbolos, arquitetura, fluxo de chamadas, estrutura de arquivos indexada e análise de impacto/testes, prefira as ferramentas `codegraph_*` antes de usar pesquisa textual simples (`grep`, `find`, `ls`) ou leitura manual ampla. Use `read` apenas quando precisar validar trechos exatos ou preparar edições.
```

Se `.codegraph/` não existir, a orientação deve ser diferente:

```markdown
Este projeto ainda não tem CodeGraph inicializado. Se a tarefa envolver exploração ampla do código, considere sugerir `codegraph_init` antes de fazer buscas manuais extensas.
```

### Nível 3 — Política forte opcional

Como modo futuro e opcional, a extensão pode interceptar chamadas com `pi.on("tool_call")` para detectar usos de `grep`, `find`, `ls`, `bash` com `rg/find/grep`, ou leituras amplas quando `.codegraph/` existir.

Esse modo pode:

- apenas avisar;
- pedir confirmação;
- reescrever a estratégia sugerindo `codegraph_search`/`codegraph_context`;
- bloquear padrões específicos de exploração manual.

Esse bloqueio não deve ser padrão, pois pode atrapalhar tarefas legítimas de edição, verificação de arquivos específicos ou debug rápido.

### Heurística recomendada

- Para “onde está X?”, “como funciona Y?”, “qual fluxo chama Z?”, “quais arquivos são relevantes?”: usar CodeGraph primeiro.
- Para “edite este arquivo”, “confirme esta linha”, “aplique patch”, “rode testes”: usar ferramentas nativas do Pi normalmente, possivelmente com CodeGraph como apoio.
- Para projetos pequenos ou sem `.codegraph/`: não forçar CodeGraph.

## 9. Critérios de aceite

- O pacote carrega com `pi -e .`.
- O `package.json` contém manifesto `pi.extensions`.
- As ferramentas aparecem no conjunto de ferramentas do Pi.
- A extensão funciona em projeto com `.codegraph/` existente.
- A extensão falha de forma clara em projeto sem `.codegraph/`, sugerindo `codegraph_init`.
- Não há chamadas MCP.
- Não depende de configuração do Claude Code, Cursor, Codex CLI ou opencode.
- Outputs grandes são truncados.
- Erros da CLI são reportados como erro de ferramenta.
- Caminhos são resolvidos de forma previsível a partir de `ctx.cwd`.

## 10. Milestones

### M0 — SPEC + esqueleto do pacote

- Criar `SPEC.md`.
- Criar `package.json`.
- Criar `index.ts` mínimo que registra extensão sem ferramentas complexas.
- Criar `README.md` inicial.

### M1 — Wrapper CLI

- Implementar `src/cli.ts`.
- Construir argumentos sem shell interpolation.
- Adicionar parse JSON/fallback texto.
- Adicionar timeout, truncamento e erros padronizados.

### M2 — Ferramentas básicas

- Implementar:
  - `codegraph_status`
  - `codegraph_search`
  - `codegraph_files`
  - `codegraph_context`

### M3 — Mutação/indexação

- Implementar:
  - `codegraph_init`
  - `codegraph_index`
  - `codegraph_sync`
  - `codegraph_affected`

### M4 — Comandos e UX

- Implementar comandos slash.
- Adicionar notificações/status opcionais.
- Revisar `promptSnippet` e `promptGuidelines`.

### M5 — Testes locais

- Testar em projeto sem `.codegraph/`.
- Testar em projeto inicializado.
- Testar erro de CLI ausente.
- Testar truncamento de saída grande.
- Testar cancelamento/timeout.

### M6 — Preparação npm

- Revisar nome do pacote.
- Preencher README.
- Validar licença.
- Validar `npm pack`.
- Documentar instalação via `pi install npm:pi-codegraph`.

## 11. Referências

- CodeGraph GitHub: https://github.com/colbymchenry/codegraph
- CodeGraph npm: https://www.npmjs.com/package/@colbymchenry/codegraph
- Pi packages: `docs/packages.md`
- Pi extensions: `docs/extensions.md`
