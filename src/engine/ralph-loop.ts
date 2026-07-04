import { saveState } from "./state-machine";

export async function runRalphLoop(workspaceRoot: string, state: any, input: any, client: any): Promise<void> {
  if (
    state.phase === "EXECUTING" &&
    state.tasks.completed > 0 &&
    state.tasks.completed % 3 === 0 &&
    state.tasks.lastCompactedAtTask !== state.tasks.completed
  ) {
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

        // Marca que precisa compactar quando a sessão ficar ociosa
        state.tasks.lastCompactedAtTask = state.tasks.completed;
        state.tasks.needsCompaction = true;
        state.tasks.compactionSessionId = input.sessionID;
        saveState(workspaceRoot, state);
      } catch (e: any) {
        console.error("Erro no Ralph Loop ao preparar compactação:", e);
      }
    }
  }
}
