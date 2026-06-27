import { existsSync } from "fs";
import { join } from "path";
import { CARAMELO_DIR } from "../types";
import { initCaramelo } from "../scaffolding/init";

export function detectOrInitCaramelo(workspaceRoot: string): boolean {
  // Inicialização automática conforme requisitado
  initCaramelo(workspaceRoot);
  
  const carameloPath = join(workspaceRoot, CARAMELO_DIR);
  return existsSync(carameloPath);
}
