import { Phase } from "../types";

let toolCallCount = 0;

export function checkWakeupCall(phase: Phase): void {
  if (phase !== "EXECUTING") return;
  
  toolCallCount++;
  
  // A cada 15 chamadas de ferramenta na fase EXECUTING, joga um erro inofensivo
  // que o LLM vai ler como output da ferramenta. Isso "acorda" o LLM.
  if (toolCallCount > 0 && toolCallCount % 15 === 0) {
    throw new Error(
      `🐕 [CARAMELO] WAKEUP CALL (Anti-Laziness):\n` +
      `Você já realizou ${toolCallCount} operações nesta fase.\n\n` +
      `PARE e execute o SelfVerification checklist internamente ANTES da próxima ação:\n` +
      `1. A task atual está alinhada com o design.md aprovado?\n` +
      `2. Você executou os testes recentemente e confirmou que eles passam?\n` +
      `3. Você NÃO está tomando atalhos proibidos (scripts python/sh, sed, apagando testes)?\n\n` +
      `Esta é uma mensagem do sistema. Repita a sua chamada de ferramenta agora que você leu este lembrete.\n` +
      `Se estiver travado ou em loop, PARE e peça orientação ao humano.`
    );
  }
}
