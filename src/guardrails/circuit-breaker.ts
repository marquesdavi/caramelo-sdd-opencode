import { loadState, saveState } from "../engine/state-machine";

let consecutiveErrors = 0;

export function resetCircuitBreaker() {
  consecutiveErrors = 0;
}

export async function checkCircuitBreaker(workspaceRoot: string, error: any, client: any) {
  if (error && error.message && error.message.includes("WAKEUP CALL")) {
    return;
  }

  consecutiveErrors++;

  if (consecutiveErrors >= 4) { // Alterado para 3 (Fail-Fast)
    consecutiveErrors = 0;

    // Systemic Lock: Trava fisicamente a IA
    const state = loadState(workspaceRoot);
    state.awaitingInitialInput = true;
    saveState(workspaceRoot, state);

    if (client && client.tui) {
      await client.tui.showToast({
        body: {
          title: "🐕 Caramelo",
          message: "Circuit Breaker ativado. Agente travado repetindo erros de guardrail. Intervenção humana necessária.",
          variant: "error",
          duration: 10000
        }
      });
    }

    throw new Error(
      `🐕 [CARAMELO] 🛑 CIRCUIT BREAKER ATIVADO (Falhas Consecutivas):\n` +
      `Você atingiu as travas de segurança do Caramelo (Guardrails) 4 vezes seguidas.\n` +
      `Isso indica que você está travado em um loop de erro ou tentando tomar atalhos proibidos sucessivamente.\n\n` +
      `AÇÃO OBRIGATÓRIA: PARE de tentar usar ferramentas!\n` +
      `Uma trava mecânica foi ativada. Você não tem mais permissão para continuar.\n` +
      `Peça desculpas, explique EXATAMENTE onde você está travado e aguarde o humano digitar no chat para destravar você.`
    );
  }
}
