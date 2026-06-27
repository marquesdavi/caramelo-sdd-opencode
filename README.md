# 🐕 Caramelo (caramelo-sdd-opencode) - v4.1

**Caramelo** é um plugin *Enterprise-Grade* para a IDE OpenCode focado em **Agentic Compliance** e **Spec-Driven Development (SDD)**. 
Ao contrário de assistentes de IA genéricos (que podem ignorar testes, alucinar soluções e criar código excessivo), o Caramelo emprega técnicas extremas de **Harness Engineering** para forçar o LLM a operar num ciclo de vida estrito, limpo e determinístico.

Este projeto substitui a "esperança baseada em prompts" por *Hardened Guardrails*, validadores rigorosos de estado, extração semântica e interceptadores de build.

---

## 🎯 Por que o Caramelo existe?

LLMs sofrem de *Agent Laziness* (preguiça), *Context Rot* (perda de contexto), e principalmente **Alucinações de Mapeamento** em sessões longas. Eles tentam resolver problemas "hackeando" a base de código, instalam dezenas de bibliotecas externas sem necessidade e codificam "às cegas".

O Caramelo atua como um **Harness (Cinto de Segurança)** intransponível. Ele é uma máquina de estados finitos que rege 4 fases de desenvolvimento:
**Requirements** → **Design** → **Tasks** → **Executing**

---

## ✨ Arquitetura & Funcionalidades (Harness Engineering v4.1)

A arquitetura incorpora o estado da arte de 2026 em controle de Inteligência Artificial para Engenharia de Software Crítica:

### 1. 🔍 Discovery Engine & Graph-First Context
Em vez de ler milhares de linhas de código brutalmente (causando poluição no contexto), o Caramelo usa a API `client.find.symbols()` do OpenCode para extrair a **Árvore Semântica (AST)** do projeto de forma nativa. O agente mapeia classes, métodos e assinaturas silenciosamente e constrói um `.caramelo/architecture_map.md` antes mesmo de planejar a refatoração.

### 2. 🐴 Ponytail Protocol (YAGNI)
O Caramelo possui um engenheiro sênior "preguiçoso" internalizado. O protocolo impõe o reuso radical (YAGNI): o agente é proibido de sugerir a instalação de pacotes externos ou criar abstrações complexas e vazias se o problema puder ser resolvido nativamente (ex: usando a `stdlib` em menos de 20 linhas).

### 3. 🎯 Tool-Integrated Decoding
O modelo é estritamente proibido de codificar modificações ou gerenciar dependências "de memória" (*blind coding*). O sistema exige que ele invoque ferramentas como `client.find.text()` no workspace para ler assinaturas exatas antes de atualizar chamadas de métodos, reduzindo alucinações para quase zero.

### 4. 🧱 AST Task Breakdown
Chega de tarefas monstras. Nas refatorações, o LLM é forçado a usar **Quebra de Tarefas Baseada em Árvore Sintática (AST)**. Ele cria etapas 100% isoladas (ex: 1. Extrair interface; 2. Implementar classe; 3. Injetar dependência) onde cada etapa **deve compilar de forma independente**.

### 5. 🚦 Shadow Compilation & Verification Gate
Antes que o modelo marque uma tarefa como concluída (`[x]`), o plugin intercepta a chamada no nível de Sistema Operacional (Background Process).
- **Shadow Compilation**: A cada alteração de arquivo (`.ts`, `.java`, etc.), o Caramelo roda o compilador (`tsc`, `mvn clean compile`) silenciosamente. Se o agente quebrou a sintaxe, ele bloqueia a escrita e devolve o log de erro para o LLM.
- **Test Gate**: Na marcação final da tarefa, os testes unitários (`npm test`, `mvn clean test`) são executados. Falhas resultam em reversão.

### 6. 🛡️ Progressive Context & Tool Interceptors
- O *System Prompt* cresce dinamicamente. Restrições agressivas só pesam na memória do agente quando ele realmente precisa escrever código.
- Durante o Planejamento, o agente é bloqueado de escrever fora do diretório `.caramelo/` (Zero-Trust Sandbox).

### 7. 🔄 Ralph Loop & Circuit Breaker
- **Context Rot**: A cada 3 tarefas concluídas, o sistema força uma compactação inteligente via API do OpenCode para preservar o histórico de decisões.
- **Doom Loop Prevention**: Falhas consecutivas de compilação bloqueiam a inferência e pedem ajuda ao humano via `tui.showToast()`.

---

## 🚀 Instalação e Uso

1. Clone o repositório no seu ambiente de desenvolvimento.
2. Instale as dependências:
   \`\`\`bash
   bun install
   \`\`\`
3. Para compilar o plugin (Gera o arquivo \`dist/index.js\`):
   \`\`\`bash
   bun run build
   \`\`\`
4. Carregue o plugin na sua interface do OpenCode.

## 💬 Comandos Disponíveis (Chat)

O agente Caramelo reage aos comandos:
- \`/caramelo status\`: Mostra a fase atual e as tasks pendentes.
- \`/caramelo skip\`: Pula para a próxima fase do SDD (O Guardrail interceptará e auditará seu `tasks.md` antes de permitir o pulo).
- \`/caramelo reset\`: Abandona a Spec atual e volta para IDLE.
- \`/caramelo feature <nome>\`: Inicia uma especificação técnica padrão.
- \`/caramelo bugfix <nome>\`: Inicia um escopo focado em Root-Cause Analysis.
- \`/caramelo refactor <nome>\`: Ativa o Modo de Refatoração Seguro (Discovery Engine + AST Tasking).

---
**Nota Técnica:** Este projeto nasceu de uma auditoria completa (2025-2026) sobre resiliência em assistentes de programação e evoluiu da sua base V3/V4 para a V4.1, assumindo total integração com as APIs nativas do \`@opencode-ai/sdk\` para controle de sessão, símbolos, compilação de sombra e UI.
