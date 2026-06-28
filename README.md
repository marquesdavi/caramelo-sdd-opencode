# 🐕 Caramelo (caramelo-sdd-opencode) - v1

**Caramelo** é um plugin *Enterprise-Grade* para a IDE OpenCode focado em **Agentic Compliance** e **Spec-Driven Development (SDD)**. 

Ao contrário de assistentes de IA genéricos (que podem ignorar testes, alucinar soluções, escrever código em locais errados ou pular etapas de planejamento), o Caramelo emprega técnicas extremas de **Harness Engineering**. Ele atua como um supervisor rigoroso, forçando o LLM a operar num ciclo de vida estrito, limpo e determinístico.

Este projeto substitui a "esperança baseada em prompts" por *Hardened Guardrails*, interceptadores nativos e mitigação de "Context Rot", garantindo que a Inteligência Artificial entregue código de nível de produção.

---

## 🏢 Valor para o Dia a Dia e Sistemas Enterprise

Em sistemas críticos ou legados (Enterprise-Level), deixar um agente de IA codificar livremente é um risco à arquitetura. O Caramelo resolve os maiores problemas do uso corporativo de IAs:

- **Fim da Síndrome de Pressa (Anti-Rush):** O agente não sai codificando sem planejar. O Caramelo trava o agente na fase de especificação (Zero-Trust Sandbox). Se a IA tentar criar código antes da hora, o plugin bloqueia a ação a nível de sistema operacional.
- **Segurança contra "Context Rot":** Sessões muito longas fazem a IA "esquecer" regras (Lost-in-the-Middle). O Caramelo detecta o peso da sessão e injeta *Prompt Anchoring* e diretrizes rigorosas de *Targeted Retrieval (RAG)*, forçando o agente a re-ler sua arquitetura antes de fazer qualquer besteira.
- **Código que Realmente Compila (Fail-Fast Pipeline):** Através do *Shadow Compiler*, cada alteração no disco dispara uma checagem ordenada por custo (Lint -> Typecheck -> Compiler). Se houver erro de sintaxe ou variável não usada, o agente é notificado em milissegundos e obrigado a corrigir, entregando ao desenvolvedor apenas o que funciona.

---

## ✨ Arquitetura & Funcionalidades

A arquitetura incorpora o estado da arte em controle de Inteligência Artificial para Engenharia de Software Crítica:

### 1. 🔍 Discovery Engine & Graph-First Context
O Caramelo usa a API `client.find.symbols()` do OpenCode para extrair a **Árvore Semântica (AST)** do projeto de forma nativa. O agente mapeia dependências e constrói um mapa arquitetural antes de planejar refatorações.

### 2. 🐴 Ponytail Protocol (YAGNI)
O protocolo impõe o reuso radical: o agente é bloqueado cognitivamente de sugerir a instalação de pacotes externos ou criar abstrações complexas e vazias se o problema puder ser resolvido usando a biblioteca padrão da linguagem.

### 3. 🚦 Fail-Fast Pipeline & Shadow Compilation
Ao invés de apenas rodar comandos pesados de build, o Caramelo escaneia o projeto e monta um pipeline de checagem.
- **Fail-Fast:** Roda Linters (`npm run lint`, `go vet`) primeiro. Falhou? O agente é barrado instantaneamente.
- **Shadow Build:** Só se o lint passar, o compilador pesado roda em background.
O agente nunca consegue entregar código quebrado para o humano.

### 4. 🛑 Anti-Rush Guardrails (Tool Interceptors)
Se o usuário der um mega-prompt mandando o agente pular etapas, o Caramelo bloqueia fisicamente a criação de arquivos fora da fase correta. Por exemplo: na fase `REQUIREMENTS`, tentar escrever o `design.md` resulta num erro de interceptação (Anti-Shortcut), forçando a IA a parar e consultar o humano.

### 5. 🧠 Context Rot Mitigation & Ralph Loop
- **Ralph Loop:** A cada 3 tarefas de implementação concluídas, o sistema força a compactação da sessão.
- **RAG & Prompt Anchoring:** Após compactar a lousa mental da IA, o Caramelo injeta injeções silenciosas (`client.session.prompt` com `noReply: true`) ordenando que o agente utilize `view_file` para reler integralmente o *design.md* e evitar alucinações.

### 6. 🧱 AST Task Breakdown & Verification Gate
O LLM quebra o *design* em tarefas atômicas (AST-based) no `tasks.md`. 
Sempre que uma tarefa é marcada como `[x]`, o **Test Gate** roda os testes unitários da aplicação (`mvn clean test`). Se quebrar, a task é revertida e a IA deve consertar o código.

---

## 🚀 Como Utilizar no Dia a Dia

O Caramelo rege o trabalho através de uma **Máquina de Estados**. Para utilizá-lo corretamente, siga o fluxo:

1. **Início (IDLE):**
   - Chame o plugin no chat: `/caramelo feature CarrinhoDeCompras` ou `/caramelo refactor MigrateToPostgres`.
2. **Fase REQUIREMENTS:**
   - O agente fará perguntas para preencher lacunas (Discovery Interview).
   - Ele gerará um `requirements.md` (ou `bugfix.md`).
   - Quando ele terminar e pedir permissão, você digita **`/caramelo skip`**.
3. **Fase DESIGN:**
   - O agente mapeará as dependências e criará o `design.md` com arquitetura e regras.
   - Aprove a arquitetura usando **`/caramelo skip`**.
4. **Fase TASKS:**
   - O agente desdobrará o design em um checklist executável no `tasks.md`.
   - Revise o plano e confirme usando **`/caramelo skip`**.
5. **Fase EXECUTING:**
   - O agente passará a editar os arquivos de código, tarefa por tarefa.
   - Em background, o *Shadow Compiler*, o *Ralph Loop* e o *Test Gate* estarão monitorando, bloqueando falhas e refrescando a memória dele automaticamente.
6. **Conclusão:** 
   - Ao finalizar, o Caramelo limpa o estado e volta para IDLE.

---

## 🛠️ Instalação

1. Clone o repositório no seu ambiente de desenvolvimento.
2. Instale as dependências:
   ```bash
   bun install
   ```
3. Para compilar o plugin (Gera o arquivo `dist/index.js`):
   ```bash
   bun run build
   ```
4. Carregue o plugin na sua interface do OpenCode.

## 💬 Comandos Úteis

- `/caramelo status`: Mostra a fase atual e as tasks pendentes.
- `/caramelo skip`: Autoriza o agente a avançar para a próxima fase.
- `/caramelo reset`: Abandona a Spec atual imediatamente.
