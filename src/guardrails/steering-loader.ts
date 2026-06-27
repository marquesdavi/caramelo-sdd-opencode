import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { CARAMELO_DIR, STEERING_DIR } from "../types";

export async function loadSteeringContext(workspaceRoot: string): Promise<string> {
  const steeringDir = join(workspaceRoot, CARAMELO_DIR, STEERING_DIR);
  let context = "";

  // 1. Carrega AGENTS.md (Lei Suprema)
  const agentsMdPath = join(workspaceRoot, "AGENTS.md");
  if (existsSync(agentsMdPath)) {
    const agentsMdContent = readFileSync(agentsMdPath, "utf-8");
    context += `\n<Constitution>\n${agentsMdContent}\n</Constitution>\n`;
  }

  // 2. Carrega .caramelo/steering/*.md
  if (existsSync(steeringDir)) {
    let steeringContent = "";
    const files = readdirSync(steeringDir).filter(f => f.endsWith(".md"));
    
    for (const file of files) {
      const raw = readFileSync(join(steeringDir, file), "utf-8");
      // Tratamento simplificado de frontmatter para o modo "always"
      // Assume-se que se não tem inclusion, é always. Se tiver, precisa ser always.
      if (!raw.includes("inclusion: fileMatch") && !raw.includes("inclusion: manual") && !raw.includes("inclusion: auto")) {
        // Remover frontmatter para limpar a leitura (se tiver --- no início e no fim)
        const cleanContent = raw.replace(/^---\n[\s\S]*?\n---\n/, "");
        steeringContent += `\n<Steering source="${file}">\n${cleanContent}\n</Steering>\n`;
      }
    }
    
    if (steeringContent) {
      context += `\n<SteeringRules>\n${steeringContent}\n</SteeringRules>\n`;
    }
  }

  return context;
}
