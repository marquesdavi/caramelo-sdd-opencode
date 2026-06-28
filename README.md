# 🐕 Caramelo (caramelo-sdd-opencode) - v1

**Caramelo** é um plugin *Enterprise-Grade* para a IDE OpenCode focado em **Agentic Compliance** e **Spec-Driven Development (SDD)**. 

Ao contrário de assistentes de IA genéricos que tentam agir de forma irrestrita e acabam gerando dívida técnica, o Caramelo emprega disciplinas de **Harness Engineering**. Ele atua como um exoesqueleto de fluxo de trabalho: força o LLM a operar num ciclo de vida estrito, previsível e fatiado, garantindo que todo planejamento e execução sejam documentados para facilitar a supervisão, aprovação e validação fina por parte do engenheiro de software (humano) responsável.

Este projeto substitui a "esperança baseada em prompts" por *Hardened Guardrails*, interceptadores nativos e mitigação de "Context Rot", elevando a qualidade e a transparência do código gerado pela Inteligência Artificial.

---

## 🏢 Valor para o Dia a Dia e Sistemas Enterprise

Em sistemas complexos, legados ou de alto rigor (Enterprise-Level), agentes de IA não substituem a engenharia humana — eles precisam ser guiados, contidos e validados. Deixar um LLM codificar livremente em bases de código extensas gera dívida técnica e riscos à arquitetura. O Caramelo atua como um facilitador disciplinado, garantindo que o agente prepare o terreno corretamente para a validação humana:

- **Fim da Síndrome de Pressa (Anti-Rush):** O agente é impedido de codificar sem planejar. O Caramelo trava o agente na fase de especificação (Zero-Trust Sandbox), obrigando-o a documentar a solução para que você (o engenheiro humano) possa revisar e aprovar o *design* antes que qualquer linha de código-fonte seja alterada.
- **Segurança contra "Context Rot":** Sessões muito longas fazem a IA "esquecer" regras (Lost-in-the-Middle). O Caramelo detecta o peso da sessão e injeta *Prompt Anchoring* e diretrizes rigorosas de *Targeted Retrieval (RAG)*, forçando o agente a re-ler sua arquitetura e manter a consistência do código ao longo de refatorações complexas.
- **Validação Preliminar Contínua (Fail-Fast Pipeline):** Através do *Shadow Compiler*, cada alteração no disco dispara uma checagem básica ordenada por custo (Lint -> Typecheck -> Compiler). O agente é forçado a resolver erros sintáticos rasos sozinho, poupando seu tempo na revisão de PRs. **Atenção:** O sistema garante apenas que o código compila; a responsabilidade de validar a lógica de negócios e a integridade da arquitetura continua sendo 100% humana.

---

## ✨ Arquitetura & Funcionalidades

A arquitetura incorpora padrões rigorosos de controle de Inteligência Artificial voltados para Sistemas Complexos:

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
