import { Phase } from "../types";
import { getSessionFailCount } from "./shadow-compiler";
import { loadState, saveState } from "../engine/state-machine";
import { logger } from "../utils/logger";

let toolCallCount = 0;

export function resetWakeupCallCount() {
  toolCallCount = 0;
}

export async function checkWakeupCall(workspaceRoot: string, phase: Phase, input: any, output: any, client: any): Promise<void> {
  if (phase !== "EXECUTING") return;
  
  const toolName = input?.tool || "";
  const sessionId = input?.sessionID || "default";
  
  // Ignora ferramentas de leitura (incluindo MCP WebFetch, searches, views e ferramentas nativas do OpenCode)
  const isReadOnly = ["read", "grep", "glob", "view_file", "list_dir", "grep_search", "search_web", "read_url_content", "read_browser_page", "mcp_", "browser_subagent", "list_resources", "read_resource", "find.text", "find.files", "find.symbols"].some(t => toolName.includes(t));
  
  // Não acorda nem incrementa contador se for apenas uma leitura pacífica
  if (isReadOnly || toolName === "search_web") {
    return;
  }

  const failCount = getSessionFailCount(sessionId);

  // Edge Case C & D: Hard-Stop Limit (3 ou mais falhas) com trava Sistêmica
  if (failCount >= 3) {
    const msg = `🐕 [CARAMELO] HARD STOP WAKEUP CALL:\nVocê falhou em consertar o build 3 vezes seguidas.\nPARE IMEDIATAMENTE E PEÇA AJUDA AO HUMANO. Não tente adivinhar a solução.`;
    try {
      // Ativa o bloqueio sistêmico (impedido de chamar ferramentas)
      const state = loadState(workspaceRoot);
      state.awaitingInitialInput = true;
      saveState(workspaceRoot, state);
      
      logger.log("🐕 [CARAMELO] Hard Stop Sistêmico ativado via Wakeup Call.");

      if (client && input?.sessionID) {
        await client.session.prompt({
          path: { id: input.sessionID },
          body: {
            agent: "caramelo",
            noReply: true,
            parts: [{ type: "text", text: msg }]
          }
        });
      }
    } catch (e) {}
    return; // Congela o contador e envia o hard-stop
  }

  // Se o agente está em estado de Recuperação (failCount > 0), Congela a Fadiga
  if (failCount > 0) {
    logger.log(`🐕 [CARAMELO] Wakeup Call: Agente em modo de recuperação de build (Imunidade ativa).`);
    return;
  }
  
  toolCallCount++;
  
  // A cada 15 chamadas de ferramenta na fase EXECUTING, injeta um prompt silencioso no contexto.
  if (toolCallCount > 0 && toolCallCount % 15 === 0) {
    const msg = `🐕 [CARAMELO] WAKEUP CALL (Anti-Laziness):\n` +
      `Você já realizou ${toolCallCount} operações ativas nesta fase.\n\n` +
      `Lembre-se do SelfVerification checklist:\n` +
      `1. A task atual está alinhada com o design.md?\n` +
      `2. Os testes estão passando?\n` +
      `3. Se estiver travado, PARE e peça ajuda ao humano.\n`;
    
    try {
      if (client && input?.sessionID) {
        await client.session.prompt({
          path: { id: input.sessionID },
          body: {
            agent: "caramelo",
            noReply: true,
            parts: [{ type: "text", text: msg }]
          }
        });
      }
    } catch (e) {
      // Falha silenciosa caso o client falhe
    }
  }
}
