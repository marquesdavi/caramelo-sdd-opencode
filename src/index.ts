import { Plugin } from "@opencode-ai/plugin";
import { detectOrInitCaramelo } from "./utils/detection";
import { buildCarameloAgent } from "./config/agent";
import { loadState, transitionToPhase } from "./engine/state-machine";
import { loadSteeringContext } from "./guardrails/steering-loader";
import { loadGraphifyContext } from "./integrations/graphify";
import { createToolInterceptor } from "./guardrails/tool-interceptor";
import { checkWakeupCall } from "./guardrails/wakeup-call";
import { checkVerificationGate } from "./guardrails/verification-gate";
import { checkShadowCompilation } from "./guardrails/shadow-compiler";
import { checkCircuitBreaker, resetCircuitBreaker } from "./guardrails/circuit-breaker";
import { buildSystemPrompt } from "./prompts/system";
import { generateArchitectureMap } from "./utils/architecture-mapper";
import { join } from "path";
import { existsSync, readFileSync } from "fs";

export const CarameloPlugin: Plugin = async ({ directory, client }) => {
  const workspaceRoot = directory;

  if (!detectOrInitCaramelo(workspaceRoot)) {
    return {};
  }

  return {
    config: async (input) => {
      const state = loadState(workspaceRoot);
      if (!input.agent) input.agent = {};
      input.agent["caramelo"] = buildCarameloAgent(state.phase, state) as any;
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
      if (!text.startsWith("/caramelo")) return;

      const [, cmd, ...rest] = text.split(" ");
      const arg = rest.join(" ");
      const state = loadState(workspaceRoot);

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
            // Fase 3: Validação Estrutural AST para Refactoring
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
        case "bugfix":
        case "refactor":
          // Iniciar spec do tipo bugfix/refactor. Lógica simplificada de state-machine.
          state.phase = "REQUIREMENTS";
          state.specType = cmd;
          state.activeSpec = arg || `new-${cmd}`;
          // Idealmente usaria saveState
          transitionToPhase(workspaceRoot, "REQUIREMENTS");

          if (cmd === "refactor" && client) {
            output.parts = [{ type: "text", text: `🐕 Iniciando spec de Refactoring para '${state.activeSpec}'.\n⚙️ Extraindo Símbolos e gerando Mapa Arquitetural...` } as any];
            // Roda o discovery assincronamente (ou aguarda)
            await generateArchitectureMap(workspaceRoot, client, state.activeSpec || "");
          } else {
            output.parts = [{ type: "text", text: `🐕 Iniciando spec do tipo '${cmd}' para '${state.activeSpec}'.` } as any];
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

        // 1. Wakeup Call (Apenas EXECUTING)
        checkWakeupCall(state.phase);

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
        // Executa após a escrita no disco. Se quebrar, joga erro pro modelo reverter
        await checkShadowCompilation(workspaceRoot, input, output, state.phase);
      } catch (err: any) {
        throw err;
      }

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
        const specDir = join(workspaceRoot, currentState.specDir!);
        const reqPath = currentState.specType === "bugfix" ? "bugfix.md" : "requirements.md";
        const req = existsSync(join(specDir, reqPath)) ? readFileSync(join(specDir, reqPath), "utf-8") : "";
        const design = existsSync(join(specDir, "design.md")) ? readFileSync(join(specDir, "design.md"), "utf-8") : "";
        const tasks = existsSync(join(specDir, "tasks.md")) ? readFileSync(join(specDir, "tasks.md"), "utf-8") : "";

        const truncate = (str: string, len: number) => str.length > len ? str.substring(0, len) + "...\\n(truncado)" : str;

        if (!output.context) output.context = [];

        output.context.push(`
## 🐕 Caramelo — Estado SDD (NÃO PERCA ESTE CONTEXTO)
- **Fase**: ${currentState.phase}
- **SpecType**: ${currentState.specType}
- **Spec**: ${currentState.activeSpec}
- **Tasks**: ${currentState.tasks.completed}/${currentState.tasks.total}

### Requirements (resumo)
${truncate(req, 400)}

### Design (resumo)
${truncate(design, 400)}

### Tasks pendentes
${tasks || "Nenhuma"}
        `.trim());
      }

      if (!output.context) output.context = [];
      output.context.push(`
## 🐕 INSTRUÇÃO PÓS-COMPACTAÇÃO (OBRIGATÓRIO)
Após esta compactação, você DEVE:
1. Informar ao humano que houve uma compactação de contexto
2. Resumir brevemente o estado atual (fase, spec, tasks)
3. Extrair e listar brevemente as 3 principais "Decisões Arquiteturais" tomadas recentemente, para que o conhecimento crítico não se perca
4. PERGUNTAR: "Houve uma compactação. Posso continuar de onde parei?"
5. NÃO tomar NENHUMA ação até receber aprovação explícita
      `.trim());
    },

    event: async ({ event }) => {
      if (event.type === "session.compacted") {
        console.log("🐕 [CARAMELO] Sessão compactada. Pausa obrigatória ativada.");
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
