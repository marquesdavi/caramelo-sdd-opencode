export async function runCriticAgent(workspaceRoot: string, state: any, input: any, client: any): Promise<void> {
  if (
    state.phase === "EXECUTING" &&
    state.tasks.total > 0 &&
    state.tasks.completed === state.tasks.total
  ) {
    const isTasksMdEdit = ["edit", "write", "patch", "replace_file_content", "multi_replace_file_content", "write_to_file"].includes(input.tool);

    if (isTasksMdEdit && client && client.session && client.tui) {
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
}
