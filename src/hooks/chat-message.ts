import { loadState, transitionToPhase, saveState } from "../engine/state-machine";
import { resetWakeupCallCount } from "../guardrails/wakeup-call";
import { resetSessionFailCount } from "../guardrails/shadow-compiler";
import { join } from "path";
import { existsSync, readFileSync, mkdirSync, appendFileSync } from "fs";

export async function handleChatMessage(workspaceRoot: string, input: any, output: any, client: any) {
  const msg: any = output.message;
  let text = msg?.content || (output?.parts?.find((p: any) => p.type === "text") as any)?.text || "";
  const state = loadState(workspaceRoot);

  const debugLog = join(workspaceRoot, ".caramelo/debug.log");
  appendFileSync(debugLog, `\n\n[INICIO] msg: ${JSON.stringify(msg)}\ntext original: "${text}"\n`);

  // Reconstroi o comando caso o OpenCode SDK tenha extraído o slash command para o campo msg.command
  if (msg?.command && msg.command.startsWith("caramelo")) {
    text = `/${msg.command} ${text}`.trim();
  }

  appendFileSync(debugLog, `text processado: "${text}"\n`);

  // Se não é um comando caramelo
  if (!text.trim().startsWith("/caramelo")) {
    appendFileSync(debugLog, `IGNORADO: não começa com /caramelo\n`);
    
    // Ignora mensagens injetadas pelo próprio sistema (Evita que o sistema destrave a si mesmo)
    if (text.includes("[CARAMELO]")) {
      return;
    }

    // O usuário humano interviu genuinamente! Vamos perdoar as falhas passadas do agente.
    resetSessionFailCount(input.sessionID || "default");

    if (state.awaitingInitialInput) {
      state.awaitingInitialInput = false;
      saveState(workspaceRoot, state);
      // Permite que a mensagem vá para o agente normalmente
    }
    return;
  }


  const partsArray = text.trim().split(/\s+/);
  const cmd = partsArray[1];
  const arg = partsArray.slice(2).join(" ");
  appendFileSync(debugLog, `CMD: "${cmd}", ARG: "${arg}"\n`);

  switch (cmd) {
    case "status":
      output.parts = [{ type: "text", text: `🐕 Fase: ${state.phase} | SpecType: ${state.specType} | Spec: ${state.activeSpec || "nenhuma"} | Tasks: ${state.tasks.completed}/${state.tasks.total}` } as any];
      break;
    case "next":
    case "skip":
      const isSkip = cmd === "skip";
      const actionText = isSkip ? "foi ignorada. Pulando diretamente" : "foi aprovada. Avançando";

      if (state.awaitingInitialInput) {
        state.awaitingInitialInput = false;
        saveState(workspaceRoot, state);
      }
      
      if (state.phase === "REQUIREMENTS") {
        transitionToPhase(workspaceRoot, "DESIGN");
        output.parts = [{ type: "text", text: `🐕 A fase de Requisitos ${actionText} para a fase: DESIGN.\n\nPor favor, prossiga para o Design Arquitetural.` } as any];
      } else if (state.phase === "DESIGN") {
        transitionToPhase(workspaceRoot, "TASKS");
        output.parts = [{ type: "text", text: `🐕 A fase de Design ${actionText} para a fase: TASKS.\n\nPor favor, crie o plano de tarefas atômicas.` } as any];
      } else if (state.phase === "TASKS") {
        if (!isSkip && state.specType === "refactor") {
          const tasksPath = join(workspaceRoot, ".caramelo/specs", state.activeSpec || "", "tasks.md");
          if (existsSync(tasksPath)) {
            const tasksContent = readFileSync(tasksPath, "utf-8");
            const checkboxes = (tasksContent.match(/\[ \]|⬜/g) || []).length;
            if (checkboxes < 2) {
              output.parts = [{ type: "text", text: `🐕 🛑 ALERTA DE SEGURANÇA: O seu tasks.md para esta Refatoração tem poucas tarefas atômicas (${checkboxes}).\nDe acordo com o Protocolo AST, você deve quebrar a refatoração em múltiplos check-points independentemente compiláveis. Reveja o tasks.md antes de avançar!` } as any];
              break;
            }
          }
        }
        transitionToPhase(workspaceRoot, "EXECUTING");
        output.parts = [{ type: "text", text: `🐕 O plano de Tasks ${actionText} para a fase: EXECUTING.\n\nO ambiente de execução está destravado. Você está autorizado a iniciar a primeira task. Lembre-se do checklist de autoverificação.` } as any];
      } else if (state.phase === "EXECUTING") {
        const st = loadState(workspaceRoot);
        if (st.activeSpec && typeof st.activeSpec === "string") {
          st.history.push(st.activeSpec);
        }
        st.activeSpec = null;
        st.specDir = null;
        st.tasks = { total: 0, completed: 0, current: null };
        saveState(workspaceRoot, st);
        transitionToPhase(workspaceRoot, "IDLE");
        output.parts = [{ type: "text", text: `🐕 A spec ${actionText} para a fase: IDLE.\n\nVocê está livre de restrições de SDD.` } as any];
      } else if (state.phase === "IDLE") {
        transitionToPhase(workspaceRoot, "REQUIREMENTS");
        output.parts = [{ type: "text", text: `🐕 O estado IDLE ${actionText} para a fase: REQUIREMENTS.` } as any];
      }
      break;
    case "reset":
      if (state.awaitingInitialInput) {
        state.awaitingInitialInput = false;
        saveState(workspaceRoot, state);
      }
      const resetState = loadState(workspaceRoot);
      resetState.activeSpec = null;
      resetState.specDir = null;
      resetState.tasks = { total: 0, completed: 0, current: null };
      saveState(workspaceRoot, resetState);
      transitionToPhase(workspaceRoot, "IDLE");
      output.parts = [{ type: "text", text: `🐕 Resetando fluxo para IDLE.` } as any];
      break;
    case "feature":
    case "bugfix":
    case "refactor":
      let specTitle = `new-${cmd}`;
      if (arg) {
        if (arg.includes(" ")) {
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

      const newState = loadState(workspaceRoot);
      newState.phase = "REQUIREMENTS";
      newState.specType = cmd as any;
      newState.activeSpec = specTitle;
      newState.specDir = `.caramelo/specs/${specTitle}`;
      newState.tasks = { total: 0, completed: 0, current: null };
      newState.awaitingInitialInput = true; // Trava ativada!

      const specDir = join(workspaceRoot, ".caramelo/specs", newState.activeSpec || "");
      mkdirSync(specDir, { recursive: true });

      saveState(workspaceRoot, newState);
      resetWakeupCallCount();

      if (cmd === "refactor" && client) {
        output.parts = [{ type: "text", text: `[CARAMELO SYSTEM] O usuário iniciou uma spec de Refatoração baseada no texto que ele digitou. O título gerado foi '${newState.activeSpec}'.\nO ambiente foi preparado e a pasta '.caramelo/specs/${newState.activeSpec}/' foi criada para você armazenar os artefatos (requirements.md, design.md, tasks.md).\n\nSua ÚNICA tarefa agora é responder ao usuário com a seguinte mensagem (ou algo muito parecido):\n"🐕 Ambiente preparado para Refatoração em **${newState.activeSpec}**.\nA pasta '.caramelo/specs/${newState.activeSpec}' foi criada e o sistema está pronto.\n\nPor favor, me explique com o máximo de detalhes:\n1. O que você deseja refatorar?\n2. Qual é o escopo exato (quais arquivos ou módulos estão envolvidos)?\n3. Quais são as regras de negócio ou dependências que eu devo ter cuidado?"\n\nNÃO inicie nenhuma busca de arquivos. APENAS faça essas perguntas ao usuário e aguarde a resposta.` } as any];
      } else {
        output.parts = [{ type: "text", text: `[CARAMELO SYSTEM] O usuário iniciou uma spec do tipo '${cmd}' com o seguinte título gerado: '${newState.activeSpec}'.\nO ambiente foi preparado e a pasta '.caramelo/specs/${newState.activeSpec}/' foi criada para você armazenar os artefatos (requirements.md, design.md, tasks.md, bugfix.md).\n\nSua ÚNICA tarefa agora é responder ao usuário com a seguinte mensagem:\n"🐕 Ambiente preparado para a spec **${newState.activeSpec}**.\nA pasta '.caramelo/specs/${newState.activeSpec}' foi criada.\n\nPara começarmos a fase REQUIREMENTS, me explique:\n1. Qual é o objetivo desta funcionalidade/correção?\n2. Quais são os requisitos técnicos ou de negócios?"\n\nNÃO inicie nenhuma busca. APENAS pergunte e aguarde.` } as any];
      }
      break;
  }
}
