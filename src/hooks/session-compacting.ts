import { loadState, saveState } from "../engine/state-machine";
import { logger } from "../utils/logger";

export async function handleSessionCompacting(workspaceRoot: string, input: any, output: any) {
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
}

export async function handleEvent(workspaceRoot: string, event: any, client: any) {
  if (event.type === "session.idle") {
    const state = loadState(workspaceRoot);
    if (state.tasks?.needsCompaction && state.tasks?.compactionSessionId) {
      const sessionId = state.tasks.compactionSessionId;
      
      state.tasks.needsCompaction = false;
      state.tasks.compactionSessionId = undefined;
      saveState(workspaceRoot, state);

      try {
        if (client && client.session) {
          logger.log(`🐕 [CARAMELO] Sessão ociosa. Disparando compactação pendente para ${sessionId}...`);
          await client.session.summarize({ path: { id: sessionId } });
        }
      } catch (e: any) {
        logger.error(`Falha ao disparar compactação assíncrona: ${e.message || e}`);
      }
    }
  }

  if (event.type === "session.compacted") {
    logger.log("🐕 [CARAMELO] Sessão compactada. Pausa obrigatória ativada.");
    
    // Trava fisicamente a IA (Systemic Lock)
    const state = loadState(workspaceRoot);
    state.awaitingInitialInput = true;
    saveState(workspaceRoot, state);

    if (client && client.tui) {
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
