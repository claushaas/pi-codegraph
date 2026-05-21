# pi-codegraph

Extensão do **pi coding agent** que integra o [CodeGraph](https://github.com/colbymchenry/codegraph) via CLI para exploração semântica de código.

## Decisões técnicas

- **Integração via CLI, não MCP.** A extensão chama `codegraph` como binário de linha de comando. Não depende de `codegraph serve --mcp` nem de configurações dos agentes Claude Code, Cursor, Codex CLI ou opencode.
- **Binário garantido via dependency.** O pacote declara `@colbymchenry/codegraph` como `dependency`. Após `npm install`, o binário `codegraph` fica disponível em `node_modules/.bin/`.
- **Override por variável de ambiente.** Use `PI_CODEGRAPH_BIN` para apontar para uma instalação alternativa do `codegraph`.
- **Sem MCP.** Nenhuma ferramenta MCP é exposta. As ferramentas `codegraph_callers`, `codegraph_callees`, `codegraph_impact` e `codegraph_node` ficam para fase futura, se a CLI pública oferecer comandos equivalentes.

## Requisitos

- Node.js 20+ (CodeGraph requer Node >=18 e <25)
- Pi coding agent instalado
- `@colbymchenry/codegraph` (instalado automaticamente como dependência)

## Instalação local (desenvolvimento)

```bash
cd ~/.pi/agent/extensions/pi-codegraph
npm install
pi -e .
```

## Instalação via npm (futura)

```bash
pi install npm:pi-codegraph
```

## Getting Started

### 1. Instalar a extensão

```bash
cd ~/.pi/agent/extensions
# Clone ou copie o diretório pi-codegraph para cá
cd pi-codegraph
npm install
```

### 2. Inicializar CodeGraph no projeto

```bash
cd seu-projeto
codegraph init .
codegraph index .
```

### 3. Iniciar o Pi com a extensão

```bash
cd seu-projeto
pi -e ~/.pi/agent/extensions/pi-codegraph
```

No Pi, o agente receberá orientação automática para usar as ferramentas `codegraph_*`.

### 4. Exemplo de interação

```
> onde está implementada a função de login?

(agente usa codegraph_search para "login")
→ Encontrados 3 símbolos: function login (src/auth.ts:42), ...

(agente usa codegraph_context para "login flow")
→ [código relevante de src/auth.ts, src/session.ts]

(agente usa read para confirmar linhas exatas antes de editar)
```

## Ferramentas registradas no Pi

| Ferramenta | CLI equivalente | Descrição |
|---|---|---|
| `codegraph_status` | `codegraph status` | Verifica saúde e estatísticas do índice |
| `codegraph_init` | `codegraph init` | Inicializa CodeGraph no projeto |
| `codegraph_index` | `codegraph index` | Executa indexação completa |
| `codegraph_sync` | `codegraph sync` | Atualização incremental do índice |
| `codegraph_search` | `codegraph query` | Busca símbolos por nome |
| `codegraph_files` | `codegraph files` | Estrutura de arquivos indexada |
| `codegraph_context` | `codegraph context` | Constrói contexto para uma tarefa |
| `codegraph_affected` | `codegraph affected` | Arquivos de teste afetados por mudanças |

## Comandos slash

| Comando | Ação |
|---|---|
| `/codegraph-status` | Exibe status do CodeGraph no projeto atual |
| `/codegraph-init` | Inicializa CodeGraph (com confirmação) |
| `/codegraph-index` | Indexa o projeto (com confirmação) |
| `/codegraph-sync` | Atualiza incrementalmente o índice CodeGraph |

## Uso pelo agente

Quando o diretório `.codegraph/` existe no projeto, a extensão injeta instruções no system prompt para que o agente prefira as ferramentas `codegraph_*` em tarefas de exploração (localizar símbolos, entender arquitetura, mapear fluxo), e use `read`/`edit` para confirmação e edição.

## Atualização do índice

A extensão mantém o DB do CodeGraph atualizado de três formas:

- `/codegraph-sync` executa `codegraph sync` manualmente no projeto atual.
- No início de cada turno do agente, se `.codegraph/` existir, a extensão roda `codegraph sync --quiet`.
- Depois de ferramentas que alteram arquivos (`edit` e `write`) concluírem com sucesso, a extensão roda `codegraph sync --quiet` novamente.

Para rebuild completo, use `/codegraph-index` ou `codegraph index .`.

## Troubleshooting

### CodeGraph não encontrado

```bash
# Verificar instalação
npx @colbymchenry/codegraph status .

# Ou instalar globalmente
npm install -g @colbymchenry/codegraph

# Configurar binário alternativo
export PI_CODEGRAPH_BIN=/caminho/para/codegraph
```

### Projeto sem `.codegraph/`

Execute `/codegraph-init` ou `codegraph init` no diretório do projeto.

### Saída truncada

Todas as saídas respeitam o limite de 50KB / 2000 linhas. Quando truncada, a resposta inclui metadados sobre o que foi omitido.

### Indexação lenta / SQLite WASM

Se `codegraph status` mostrar `Backend: wasm`, o SQLite nativo (`better-sqlite3`) não foi compilado. Consulte o [guia do CodeGraph](https://github.com/colbymchenry/codegraph#troubleshooting) para resolver.

### Node.js 25+ (V8 WASM crash)

CodeGraph exige Node <25.0.0 devido a um bug do V8 turboshaft em Node 25+. Se você estiver em Node 25+, instale Node 22 LTS:

```bash
# nvm
nvm install 22 && nvm use 22

# Homebrew
brew install node@22 && brew link --overwrite --force node@22
```

Para forçar (NÃO recomendado, pode causar OOM):

```bash
export CODEGRAPH_ALLOW_UNSAFE_NODE=1
```

Veja a [issue #81](https://github.com/colbymchenry/codegraph/issues/81) do CodeGraph para detalhes.

## Smoke tests

Para validar manualmente se a extensão está funcionando:

### Projeto sem CodeGraph

```bash
mkdir -p /tmp/pi-codegraph-smoke-empty
cd /tmp/pi-codegraph-smoke-empty
printf 'export function hello() { return "world"; }\n' > hello.ts
pi -e /Users/claus/.pi/agent/extensions/pi-codegraph
```

No Pi:
1. `/codegraph-status` → deve sugerir inicialização
2. Peça ao agente: "find the hello function" → deve sugerir `codegraph_init`
3. `/codegraph-init` → confirme e inicialize

### Projeto com CodeGraph inicializado

```bash
mkdir -p /tmp/pi-codegraph-smoke-ready
cd /tmp/pi-codegraph-smoke-ready
printf 'export function hello() { return "world"; }\n' > hello.ts
printf 'import { hello } from "./hello";\nhello();\n' > main.ts
codegraph init .
codegraph index .
pi -e /Users/claus/.pi/agent/extensions/pi-codegraph
```

No Pi:
1. `/codegraph-status` → deve mostrar estatísticas do índice
2. Peça: "search for the hello function" → agente deve usar `codegraph_search`
3. Peça: "find tests affected by changes in hello.ts" → agente deve usar `codegraph_affected`
4. Footer do Pi deve mostrar "CodeGraph: ready"

### Verificações manuais

- [ ] Extensão carrega sem erros (`pi -e .`)
- [ ] `/codegraph-status` funciona em ambos os cenários
- [ ] `/codegraph-init` confirma antes de executar
- [ ] `/codegraph-index` confirma e indexa
- [ ] `codegraph_search` localiza símbolos
- [ ] `codegraph_context` retorna contexto relevante
- [ ] `codegraph_files` lista estrutura indexada
- [ ] `codegraph_affected` retorna arquivos de teste
- [ ] Saídas grandes são truncadas com mensagem
- [ ] Nenhuma chamada MCP acontece
- [ ] Agente recebe orientação no system prompt quando `.codegraph/` existe

## Variáveis de ambiente

| Variável | Descrição | Padrão |
|---|---|---|
| `PI_CODEGRAPH_BIN` | Caminho para o binário `codegraph` | `codegraph` |

## Licença

MIT
