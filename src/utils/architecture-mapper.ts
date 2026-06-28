import { join } from "path";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { logger } from "./logger";

export async function generateArchitectureMap(workspaceRoot: string, client: any, alvo: string) {
  try {
    if (!client || !client.find) return;

    // Dispara a requisição para puxar símbolos (buscando por tudo)
    const result = await client.find.symbols({ query: { query: "" } });
    if (!result || !result.data) return;

    const symbols = result.data;
    if (!Array.isArray(symbols) || symbols.length === 0) {
      logger.log("Nenhum símbolo encontrado no projeto.");
      return;
    }

    // Agrupa símbolos por arquivo (URI)
    const byFile: Record<string, any[]> = {};
    for (const sym of symbols) {
      const uri = sym.location?.uri || "unknown";
      if (!byFile[uri]) byFile[uri] = [];
      byFile[uri].push(sym);
    }

    let markdown = `# 🗺️ Mapa Arquitetural Semântico\n`;
    markdown += `> Gerado automaticamente via Discovery Engine para o escopo: **${alvo}**\n`;
    markdown += `Este mapa contém a estrutura global de dependências, classes e assinaturas do repositório, extraído via Análise Estática. Use isto em vez de ler os arquivos inteiros.\n\n`;

    for (const uri of Object.keys(byFile)) {
      // Limpa a string da URI para deixar só o caminho relativo se possível
      const relativePath = uri.replace("file://" + workspaceRoot, "").replace("file://", "");
      markdown += `## 📄 Arquivo: \`${relativePath}\`\n`;

      const fileSymbols = byFile[uri];
      for (const sym of fileSymbols) {
        // Map de kind básico do LSP (se conhecido)
        const kindName = getSymbolKindName(sym.kind);
        markdown += `- **${kindName}**: \`${sym.name}\` (Linha: ${sym.location?.range?.start?.line || 0})\n`;
      }
      markdown += `\n`;
    }

    const outDir = join(workspaceRoot, ".caramelo");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    const outPath = join(outDir, "architecture_map.md");
    writeFileSync(outPath, markdown, "utf-8");

    logger.log(`[CARAMELO] Mapa Arquitetural gerado com ${symbols.length} símbolos em ${outPath}`);

  } catch (error) {
    logger.error("Erro ao gerar o architecture_map.md: " + error);
  }
}

// Uma conversão simples de LSP SymbolKind para string amigável
function getSymbolKindName(kind: number): string {
  switch (kind) {
    case 1: return "File";
    case 2: return "Module";
    case 3: return "Namespace";
    case 4: return "Package";
    case 5: return "Class";
    case 6: return "Method";
    case 7: return "Property";
    case 8: return "Field";
    case 9: return "Constructor";
    case 10: return "Enum";
    case 11: return "Interface";
    case 12: return "Function";
    case 13: return "Variable";
    case 14: return "Constant";
    case 15: return "String";
    case 16: return "Number";
    case 17: return "Boolean";
    case 18: return "Array";
    case 19: return "Object";
    case 20: return "Key";
    case 21: return "Null";
    case 22: return "EnumMember";
    case 23: return "Struct";
    case 24: return "Event";
    case 25: return "Operator";
    case 26: return "TypeParameter";
    default: return "Symbol";
  }
}
