import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { State, Phase, CARAMELO_DIR, CONFIG_FILE } from "../types";

export function getCarameloConfigPath(workspaceRoot: string): string {
  return join(workspaceRoot, CARAMELO_DIR, CONFIG_FILE);
}

export function loadState(workspaceRoot: string): State {
  const path = getCarameloConfigPath(workspaceRoot);
  if (!existsSync(path)) {
    return {
      version: "1.0.0",
      phase: "IDLE",
      specType: "feature",
      activeSpec: null,
      specDir: null,
      awaitingInitialInput: false,
      tasks: { total: 0, completed: 0, current: null },
      history: [],
    };
  }
  
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    console.error("🐕 [CARAMELO] ERRO FATAL: config.json corrompido. Voltando para IDLE de segurança.", error);
    return {
      version: "1.0.0",
      phase: "IDLE",
      specType: "feature",
      activeSpec: null,
      specDir: null,
      awaitingInitialInput: false,
      tasks: { total: 0, completed: 0, current: null },
      history: [],
    };
  }
}

export function saveState(workspaceRoot: string, state: State): void {
  const path = getCarameloConfigPath(workspaceRoot);
  writeFileSync(path, JSON.stringify(state, null, 2));
}

export function transitionToPhase(workspaceRoot: string, newPhase: Phase): void {
  const state = loadState(workspaceRoot);
  state.history.push({
    phase: state.phase,
    approved_at: new Date().toISOString(),
  });
  state.phase = newPhase;
  saveState(workspaceRoot, state);
}
