import { Phase, State } from "../types";
import { buildSystemPrompt } from "../prompts/system";
import { PHASE_CONFIGS } from "./permissions";
import { PHASE_COLORS } from "./colors";

export function buildCarameloAgent(phase: Phase, state: State) {
  const phaseConfig = PHASE_CONFIGS[phase];
  
  return {
    description: `🐕 Caramelo — ${phase} ${state.activeSpec ? `[${state.activeSpec}]` : ""}`,
    mode: "primary" as const,
    model: phaseConfig.model,
    temperature: phaseConfig.temperature,
    permission: phaseConfig.permissions,
    color: PHASE_COLORS[phase],
  };
}
