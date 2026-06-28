import { Phase } from "../types";

let toolCallCount = 0;

export async function checkWakeupCall(phase: Phase, input: any, output: any, client: any): Promise<void> {
  if (phase !== "EXECUTING") return;
  
  const toolName = input?.tool || "";
  
  // Ignora ferramentas de leitura (incluindo MCP WebFetch, searches, views)
  const isReadOnly = ["view_file", "list_dir", "grep_search", "search_web", "read_url_content", "read_browser_page", "mcp_", "browser_subagent", "list_resources", "read_resource", "find.text", "find.files", "find.symbols"].some(t => toolName.includes(t));
  
  // Não acorda nem incrementa contador se for apenas uma leitura pacífica
  if (isReadOnly || toolName === "search_web") {
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
