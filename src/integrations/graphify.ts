import { existsSync, readFileSync } from "fs";
import { join } from "path";

export async function loadGraphifyContext(workspaceRoot: string): Promise<string | null> {
  const graphPath = join(workspaceRoot, "graphify-out", "graph.json");
  const reportPath = join(workspaceRoot, "graphify-out", "GRAPH_REPORT.md");

  if (!existsSync(graphPath)) return null;

  if (existsSync(reportPath)) {
    const report = readFileSync(reportPath, "utf-8");
    // Limitando tamanho do report para não estourar o contexto (2000 chars)
    const truncated = report.length > 2000 ? report.substring(0, 2000) + "...\n(truncado)" : report;
    return `
<GraphifyContext source="GRAPH_REPORT.md">
Este projeto possui um knowledge graph Graphify.
Use-o para entender a arquitetura sem ler arquivos individuais.

${truncated}
</GraphifyContext>`;
  }

  try {
    const graphStr = readFileSync(graphPath, "utf-8");
    const graph = JSON.parse(graphStr);
    const nodeCount = graph.nodes?.length || 0;
    const edgeCount = graph.edges?.length || 0;
    return `
<GraphifyContext source="graph.json">
Knowledge graph disponível: ${nodeCount} nós, ${edgeCount} arestas.
Use o comando "cat graphify-out/GRAPH_REPORT.md" para consultar detalhes.
</GraphifyContext>`;
  } catch (err) {
    return null;
  }
}
