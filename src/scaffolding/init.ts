import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { 
  CARAMELO_DIR, CONFIG_FILE, SPECS_DIR, STEERING_DIR, TEMPLATES_DIR 
} from "../types";
import { 
  DESIGN_TEMPLATE, PRODUCT_STEERING_TEMPLATE, REQUIREMENTS_TEMPLATE, 
  STRUCTURE_STEERING_TEMPLATE, TASKS_TEMPLATE, TECH_STEERING_TEMPLATE,
  BUGFIX_ANALYSIS_TEMPLATE, REFACTOR_REQUIREMENTS_TEMPLATE
} from "./templates";

export function initCaramelo(workspaceRoot: string): void {
  const carameloDir = join(workspaceRoot, CARAMELO_DIR);

  if (existsSync(carameloDir)) return;

  // Cria estrutura de pastas
  mkdirSync(join(carameloDir, STEERING_DIR), { recursive: true });
  mkdirSync(join(carameloDir, SPECS_DIR), { recursive: true });
  mkdirSync(join(carameloDir, TEMPLATES_DIR), { recursive: true });

  // Config inicial
  const initialConfig = {
    version: "1.0.0",
    phase: "IDLE",
    specType: "feature",
    activeSpec: null,
    specDir: null,
    tasks: { total: 0, completed: 0, current: null },
    history: [],
  };
  writeFileSync(join(carameloDir, CONFIG_FILE), JSON.stringify(initialConfig, null, 2));

  // Templates
  writeFileSync(join(carameloDir, TEMPLATES_DIR, "requirements.tpl.md"), REQUIREMENTS_TEMPLATE);
  writeFileSync(join(carameloDir, TEMPLATES_DIR, "bugfix.tpl.md"), BUGFIX_ANALYSIS_TEMPLATE);
  writeFileSync(join(carameloDir, TEMPLATES_DIR, "refactor.tpl.md"), REFACTOR_REQUIREMENTS_TEMPLATE);
  writeFileSync(join(carameloDir, TEMPLATES_DIR, "design.tpl.md"), DESIGN_TEMPLATE);
  writeFileSync(join(carameloDir, TEMPLATES_DIR, "tasks.tpl.md"), TASKS_TEMPLATE);

  // Steering fundacional (placeholders)
  writeFileSync(join(carameloDir, STEERING_DIR, "product.md"), PRODUCT_STEERING_TEMPLATE);
  writeFileSync(join(carameloDir, STEERING_DIR, "tech.md"), TECH_STEERING_TEMPLATE);
  writeFileSync(join(carameloDir, STEERING_DIR, "structure.md"), STRUCTURE_STEERING_TEMPLATE);
}
