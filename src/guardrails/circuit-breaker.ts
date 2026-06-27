let consecutiveErrors = 0;

export function resetCircuitBreaker() {
  consecutiveErrors = 0;
}

export async function checkCircuitBreaker(error: any, client: any) {
  // Ignora o erro se for apenas um Wakeup Call (erro benigno injetado pelo sistema)
  if (error && error.message && error.message.includes("WAKEUP CALL")) {
    return;
  }

  consecutiveErrors++;

  if (consecutiveErrors >= 5) {
    // Reseta para não ficar travado para sempre se o humano mandar tentar de novo
    consecutiveErrors = 0;

    if (client && client.tui) {
      await client.tui.showToast({
        body: {
          title: "🐕 Caramelo",
          message: "Circuit Breaker ativado. Agente travado repetindo erros. Intervenção humana necessária.",
          variant: "error",
          duration: 10000
        }
      });
    }

    throw new Error(
      `🐕 [CARAMELO] 🛑 CIRCUIT BREAKER ATIVADO (Falhas Consecutivas):\n` +
      `Você atingiu o guardrail de segurança 3 vezes seguidas.\n` +
      `Isso indica que você está travado em um loop de erro ou tentando tomar atalhos proibidos sucessivamente.\n\n` +
      `AÇÃO OBRIGATÓRIA: PARE de tentar usar ferramentas!\n` +
      `Use a ferramenta de chat para enviar uma mensagem ao humano explicando EXATAMENTE onde você está travado.\n` +
      `Não tome nenhuma ação até receber uma resposta.`
    );
  }
}
