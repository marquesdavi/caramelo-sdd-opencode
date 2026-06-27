import { join } from "path";
import { Phase, CARAMELO_DIR, SPECS_DIR, State } from "../types";
import { validateRequirements, validateDesign, validateTasks } from "../engine/phase-validator";
import { loadState, transitionToPhase } from "../engine/state-machine";

export function enforcePhaseTransition(workspaceRoot: string, targetPhase: Phase): void {
  const state = loadState(workspaceRoot);
  
  if (!state.activeSpec || !state.specDir) {
    throw new Error(`🐕 [CARAMELO] Não é possível avançar: Nenhuma spec ativa.`);
  }

  const specPath = join(workspaceRoot, state.specDir);

  if (targetPhase === "DESIGN" && state.phase === "REQUIREMENTS") {
    let reqFile = "requirements.md";
    if (state.specType === "bugfix") {
      reqFile = "bugfix.md";
    }
    const res = validateRequirements(join(specPath, reqFile), state.specType);
    if (!res.valid) {
      throw new Error(`🐕 [CARAMELO] ${reqFile} não é válido para o tipo '${state.specType}'. Verifique os critérios mínimos.`);
    }
  }

  if (targetPhase === "TASKS" && state.phase === "DESIGN") {
    const res = validateDesign(join(specPath, "design.md"));
    if (!res.valid) {
      throw new Error(`🐕 [CARAMELO] design.md não é válido. Verifique se contém a arquitetura.`);
    }
  }

  if (targetPhase === "EXECUTING" && state.phase === "TASKS") {
    const res = validateTasks(join(specPath, "tasks.md"));
    if (!res.valid) {
      throw new Error(`🐕 [CARAMELO] tasks.md não é válido. O arquivo deve ter uma lista de tarefas (checkboxes).`);
    }
  }

  // Previne encerramento da feature deixando Ghost Tasks pra trás
  if (targetPhase === "IDLE" && state.phase === "EXECUTING") {
    if (state.tasks.total > 0 && state.tasks.completed < state.tasks.total) {
      throw new Error(
        `🐕 [CARAMELO] Não é possível concluir a execução. ` +
        `Existem ${state.tasks.total - state.tasks.completed} tarefas pendentes em tasks.md.`
      );
    }
  }

  transitionToPhase(workspaceRoot, targetPhase);
}
