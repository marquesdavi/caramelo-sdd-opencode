import { Plugin } from "@opencode-ai/plugin";
import { detectOrInitCaramelo } from "./utils/detection";
import { buildCarameloAgent } from "./config/agent";
import { loadState, transitionToPhase, saveState } from "./engine/state-machine";
import { loadSteeringContext } from "./guardrails/steering-loader";
import { loadGraphifyContext } from "./integrations/graphify";
import { createToolInterceptor } from "./guardrails/tool-interceptor";
import { checkWakeupCall, resetWakeupCallCount } from "./guardrails/wakeup-call";
import { checkVerificationGate } from "./guardrails/verification-gate";
import { checkShadowCompilation } from "./guardrails/shadow-compiler";
import { checkCircuitBreaker, resetCircuitBreaker } from "./guardrails/circuit-breaker";
import { buildSystemPrompt } from "./prompts/system";
import { generateArchitectureMap } from "./utils/architecture-mapper";
import { join } from "path";
import { existsSync, readFileSync, mkdirSync } from "fs";
import { initLogger, logger } from "./utils/logger";

export const CarameloPlugin: Plugin = async ({ directory, client }) => {
  const workspaceRoot = directory;
  initLogger(workspaceRoot);

  if (!detectOrInitCaramelo(workspaceRoot)) {
    return {};
  }

  return {
    config: async (input) => {
      const state = loadState(workspaceRoot);
      if (!input.agent) input.agent = {};
      input.agent["caramelo"] = buildCarameloAgent(state.phase, state) as any;

      if (!input.command) input.command = {};
      input.command["caramelo status"] = { template: "/caramelo status", description: "Mostra a fase atual e as tasks pendentes do SDD.", agent: "caramelo" };
      input.command["caramelo skip"] = { template: "/caramelo skip", description: "Pula para a próxima fase do SDD (Design, Tasks, Executing).", agent: "caramelo" };
      input.command["caramelo reset"] = { template: "/caramelo reset", description: "Cancela o SDD atual e volta para a fase IDLE.", agent: "caramelo" };
      input.command["caramelo feature"] = { template: "/caramelo feature ", description: "Inicia uma nova spec de Feature. Digite o nome em seguida.", agent: "caramelo" };
      input.command["caramelo bugfix"] = { template: "/caramelo bugfix ", description: "Inicia uma nova spec de Bugfix. Digite o nome em seguida.", agent: "caramelo" };
      input.command["caramelo refactor"] = { template: "/caramelo refactor ", description: "Inicia uma spec de Refactoring Seguro. Digite o nome em seguida.", agent: "caramelo" };
    },

    "experimental.chat.system.transform": async (input, output) => {
      const state = loadState(workspaceRoot);
      const steeringContext = await loadSteeringContext(workspaceRoot);
      const graphifyContext = await loadGraphifyContext(workspaceRoot);

      let systemPrompt = buildSystemPrompt(state.phase, steeringContext, graphifyContext, state);

      // Injeta o mapa arquitetural nas fases de planejamento se existir
      if (state.specType === "refactor" && (state.phase === "REQUIREMENTS" || state.phase === "DESIGN")) {
        const mapPath = join(workspaceRoot, ".caramelo/architecture_map.md");
        if (existsSync(mapPath)) {
          const archMap = readFileSync(mapPath, "utf-8");
          systemPrompt += `\n\n## 🗺️ Mapa Arquitetural (Discovery Engine)\n${archMap}\n`;
        }
      }

      if (!output.system) output.system = [];
      output.system.push(systemPrompt);
    },

    "chat.message": async (input, output) => {
      const msg: any = output.message;
      const text = msg?.content || (msg?.parts?.find((p: any) => p.type === "text") as any)?.text || "";
      const state = loadState(workspaceRoot);

      // Se não é um comando caramelo, mas estamos esperando o input inicial
      if (!text.startsWith("/caramelo")) {
        if (state.awaitingInitialInput) {
          state.awaitingInitialInput = false;
          saveState(workspaceRoot, state);
          // Permite que a mensagem vá para o agente normalmente
        }
        return;
      }

      const [, cmd, ...rest] = text.split(" ");
      const arg = rest.join(" ");

      switch (cmd) {
        case "status":
          output.parts = [{ type: "text", text: `🐕 Fase: ${state.phase} | SpecType: ${state.specType} | Spec: ${state.activeSpec || "nenhuma"} | Tasks: ${state.tasks.completed}/${state.tasks.total}` } as any];
          break;
        case "skip":
          if (state.phase === "REQUIREMENTS") {
            transitionToPhase(workspaceRoot, "DESIGN");
            output.parts = [{ type: "text", text: `🐕 Pulando para a próxima fase: DESIGN...` } as any];
          } else if (state.phase === "DESIGN") {
            transitionToPhase(workspaceRoot, "TASKS");
            output.parts = [{ type: "text", text: `🐕 Pulando para a próxima fase: TASKS...` } as any];
          } else if (state.phase === "TASKS") {
            if (state.specType === "refactor") {
              const tasksPath = join(workspaceRoot, ".caramelo/specs", state.activeSpec || "", "tasks.md");
              if (existsSync(tasksPath)) {
                const tasksContent = readFileSync(tasksPath, "utf-8");
                const checkboxes = (tasksContent.match(/\[ \]/g) || []).length;
                if (checkboxes < 2) {
                  output.parts = [{ type: "text", text: `🐕 🛑 ALERTA DE SEGURANÇA: O seu tasks.md para esta Refatoração tem poucas tarefas atômicas (${checkboxes}).\nDe acordo com o Protocolo AST, você deve quebrar a refatoração em múltiplos check-points independentemente compiláveis. Reveja o tasks.md antes de avançar!` } as any];
                  break;
                }
              }
            }
            transitionToPhase(workspaceRoot, "EXECUTING");
            output.parts = [{ type: "text", text: `🐕 Pulando para a próxima fase: EXECUTING...` } as any];
          } else if (state.phase === "EXECUTING") {
            transitionToPhase(workspaceRoot, "IDLE");
            output.parts = [{ type: "text", text: `🐕 Pulando para a próxima fase: IDLE...` } as any];
          } else if (state.phase === "IDLE") {
            transitionToPhase(workspaceRoot, "REQUIREMENTS");
            output.parts = [{ type: "text", text: `🐕 Pulando para a próxima fase: REQUIREMENTS...` } as any];
          }
          break;
        case "reset":
          transitionToPhase(workspaceRoot, "IDLE");
          output.parts = [{ type: "text", text: `🐕 Resetando fluxo para IDLE.` } as any];
          break;
        case "feature":
        case "bugfix":
        case "refactor":
          // Formata o título se o usuário passou um texto
          let specTitle = `new-${cmd}`;
          if (arg) {
            if (arg.includes(" ")) {
              // Transforma em slug
              specTitle = arg.trim()
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "") // Remove acentos
                .replace(/[^a-z0-9 ]/g, "")      // Remove caracteres especiais
                .split(/\s+/)
                .slice(0, 5)                     // Pega até as 5 primeiras palavras
                .join("-");
            } else {
              specTitle = arg;
            }
          }

          // Iniciar spec do tipo feature/bugfix/refactor.
          const newState = loadState(workspaceRoot);
          newState.phase = "REQUIREMENTS";
          newState.specType = cmd as any;
          newState.activeSpec = specTitle;
          newState.awaitingInitialInput = true; // Trava ativada!

          // Prepara o diretório
          const specDir = join(workspaceRoot, ".caramelo/specs", newState.activeSpec || "");
          mkdirSync(specDir, { recursive: true });

          // Salva o estado corretamente
          saveState(workspaceRoot, newState);
          resetWakeupCallCount();

          if (cmd === "refactor" && client) {
            output.parts = [{ type: "text", text: `[CARAMELO SYSTEM] O usuário iniciou uma spec de Refatoração baseada no texto que ele digitou. O título gerado foi '${newState.activeSpec}'.\nO ambiente foi preparado. Sua ÚNICA tarefa agora é responder ao usuário com a seguinte mensagem (ou algo muito parecido):\n"🐕 Ambiente preparado para Refatoração em **${newState.activeSpec}**.\nA pasta foi criada e o sistema está pronto.\n\nPor favor, me explique com o máximo de detalhes:\n1. O que você deseja refatorar?\n2. Qual é o escopo exato (quais arquivos ou módulos estão envolvidos)?\n3. Quais são as regras de negócio ou dependências que eu devo ter cuidado?"\n\nNÃO inicie nenhuma busca de arquivos. APENAS faça essas perguntas ao usuário e aguarde a resposta.` } as any];
          } else {
            output.parts = [{ type: "text", text: `[CARAMELO SYSTEM] O usuário iniciou uma spec do tipo '${cmd}' com o seguinte título gerado: '${newState.activeSpec}'.\nO ambiente foi preparado. Sua ÚNICA tarefa agora é responder ao usuário com a seguinte mensagem:\n"🐕 Ambiente preparado para a spec **${newState.activeSpec}**.\nA pasta foi criada.\n\nPara começarmos a fase REQUIREMENTS, me explique:\n1. Qual é o objetivo desta funcionalidade/correção?\n2. Quais são os requisitos técnicos ou de negócios?"\n\nNÃO inicie nenhuma busca. APENAS pergunte e aguarde.` } as any];
          }
          break;
      }
    },

    "tool.execute.before": async (input, output) => {
      const state = loadState(workspaceRoot);

      try {
        // 0. Trajectory Logging
        if (client && client.app) {
          try {
            const argsPreview = JSON.stringify(output.args || {}).substring(0, 150);
            await client.app.log({
              body: {
                service: "caramelo",
                level: "info",
                message: `[${state.phase}] Tool: ${input.tool} | Args: ${argsPreview}`
              }
            } as any);
          } catch (e) {
            // Ignorar erros de log
          }
        }

        // 1. Wakeup Call foi movido para tool.execute.after para não usar throw Error

        // 2. Verification Gate (Run tests before marking [x] in tasks.md)
        await checkVerificationGate(workspaceRoot, input, output, state.phase);

        // 3. Tool Interceptors (Path traversal, Anti-shortcut, Restrições de spec)
        const interceptor = createToolInterceptor(workspaceRoot);
        await interceptor(input, output);

        // Se passou por todos os guardrails, reseta o circuit breaker
        resetCircuitBreaker();
      } catch (err: any) {
        await checkCircuitBreaker(err, client);
        throw err; // Repassa o erro se não estourou o limite do circuit breaker
      }
    },

    "tool.execute.after": async (input, output) => {
      const state = loadState(workspaceRoot);

      try {
        // ─── Shadow Compilation (Fase 2) ───
        // Executa após a escrita no disco. Reporta erros via prompt silencioso.
        await checkShadowCompilation(workspaceRoot, input, output, state.phase, client);
      } catch (err: any) {
        throw err;
      }

      // Injeta o Wakeup Call via client.session.prompt (sem interromper a AI)
      await checkWakeupCall(workspaceRoot, state.phase, input, output, client);

      // ─── Ralph Loop (Stateless Task Loop) ───
      // Se completou múltiplas de 3 tasks, sugere e força a compactação do contexto
      // para evitar o 'context rot'.
      if (
        state.phase === "EXECUTING" &&
        state.tasks.completed > 0 &&
        state.tasks.completed % 3 === 0
      ) {
        // Checa se a ferramenta foi uma edição para evitar loops infinitos se ele rodar run_command
        const isEditTool = ["edit", "write", "patch", "replace_file_content", "multi_replace_file_content"].includes(input.tool);

        if (isEditTool && client && client.session && client.tui) {
          try {
            await client.tui.showToast({
              body: {
                title: "🐕 Ralph Loop",
                message: `${state.tasks.completed} tasks concluídas. Compactando sessão para refrescar contexto...`,
                variant: "info",
                duration: 6000
              }
            } as any);

            // Tenta forçar a compactação chamando summarize na sessão atual
            await client.session.summarize({ path: { id: input.sessionID } });
          } catch (e) {
            // Ignora se não for suportado
          }
        }
      }

      // ─── Critic Agent (Quality Check) ───
      // Se acabou de completar a última task, roda o validador em background
      if (
        state.phase === "EXECUTING" &&
        state.tasks.total > 0 &&
        state.tasks.completed === state.tasks.total
      ) {
        const isTasksMdEdit = ["edit", "write", "patch", "replace_file_content", "multi_replace_file_content", "write_to_file"].includes(input.tool);

        if (isTasksMdEdit && client && client.session && client.global) {
          try {
            await client.tui.showToast({
              body: {
                title: "🐕 Critic Agent",
                message: "Analisando a qualidade do código com base no design aprovado...",
                variant: "info",
                duration: 8000
              }
            } as any);

            const criticSession = await client.session.create({ body: { title: "Caramelo Critic" } });

            if (!criticSession.data?.id) throw new Error("Falha ao criar sessão Critic");

            const criticResult = await client.session.prompt({
              path: { id: criticSession.data.id },
              body: {
                agent: "caramelo",
                outputFormat: {
                  type: "json_schema",
                  schema: {
                    type: "object",
                    properties: {
                      approved: { type: "boolean", description: "O código atende perfeitamente ao design.md?" },
                      issues: { type: "array", items: { type: "string" }, description: "Problemas encontrados (máximo 3)" }
                    },
                    required: ["approved", "issues"],
                    additionalProperties: false
                  }
                },
                parts: [{
                  type: "text",
                  text: `Analise as mudanças recentes no workspace. Verifique se estão aderentes ao design.md da spec '${state.activeSpec}'. Não considere pequenos lints, foque na arquitetura.`
                }]
              }
            } as any);

            const parts = criticResult.data?.parts || [];
            const criticText = (parts.find((p: any) => p.type === "text") as any)?.text || "{}";
            const criticData = JSON.parse(criticText);

            if (criticData.approved) {
              await client.tui.showToast({
                body: {
                  title: "🐕 Critic Agent",
                  message: "✅ Código arquiteturalmente aprovado! Pronto para IDLE.",
                  variant: "success",
                  duration: 8000
                }
              } as any);
            } else {
              const issuesStr = (criticData.issues || []).join(" | ");
              await client.tui.showToast({
                body: {
                  title: "🐕 Critic Agent Reprovou",
                  message: `Atenção: ${issuesStr}`,
                  variant: "error",
                  duration: 15000
                }
              } as any);
            }
          } catch (e) {
            console.error("Erro no Critic Agent:", e);
          }
        }
      }
    },

    "experimental.session.compacting": async (input, output) => {
      const currentState = loadState(workspaceRoot);

      if (currentState.activeSpec) {
        if (!output.context) output.context = [];

        output.context.push(`
## 🐕 Caramelo — Estado SDD Pós-Compactação (CRÍTICO)
- **Fase**: ${currentState.phase}
- **SpecType**: ${currentState.specType}
- **Spec Ativa**: ${currentState.activeSpec}
- **Tasks**: ${currentState.tasks.completed}/${currentState.tasks.total}

⚠️ **AVISO DE AMNÉSIA DE CONTEXTO (CONTEXT ROT MITIGATION)** ⚠️
A sessão acaba de ser compactada pelo Ralph Loop para preservar sua performance e foco.
O histórico longo de conversas e logs de terminal foi APAGADO.
`);
      }

      if (!output.context) output.context = [];
      output.context.push(`
## 🐕 INSTRUÇÃO DE RECUPERAÇÃO DE MEMÓRIA (RAG)
Para evitar alucinações (Context Rot), você está terminantemente PROIBIDO de continuar a execução da próxima task confiando apenas no que você acha que lembra do design arquitetural.

Após esta compactação, você DEVE tomar as seguintes ações, em ordem:
1. Informar ao humano que a sessão foi compactada para manter o agente com alta precisão.
2. Usar sua ferramenta de ler arquivo (\`view_file\`) para LER NA ÍNTEGRA o \`design.md\` e o \`tasks.md\` da spec ativa. Esta é sua Memória Persistente.
3. Extrair os princípios de arquitetura do design.md lido e sumarizá-los brevemente para ancorar seu novo contexto (Prompt Anchoring).
4. PERGUNTAR: "Contexto recuperado com sucesso. Posso prosseguir com a próxima task?"
5. NÃO tome NENHUMA ação destrutiva ou edição de código até ler os arquivos base e receber aprovação.
      `.trim());
    },

    event: async ({ event }) => {
      if (event.type === "session.compacted") {
        logger.log("🐕 [CARAMELO] Sessão compactada. Pausa obrigatória ativada.");
        if (client && client.global) {
          await client.tui.showToast({
            body: {
              title: "🐕 Caramelo",
              message: "Sessão compactada. Aguardando aprovação para continuar.",
              variant: "info",
              duration: 8000
            }
          } as any);
        }
      }
    }
  };
};

export default CarameloPlugin;
