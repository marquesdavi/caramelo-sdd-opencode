import { loadState } from "../engine/state-machine";
import { loadSteeringContext } from "../guardrails/steering-loader";
import { loadGraphifyContext } from "../integrations/graphify";
import { buildSystemPrompt } from "../prompts/system";
import { join } from "path";
import { existsSync, readFileSync } from "fs";

export async function handleSystemTransform(workspaceRoot: string, input: any, output: any) {
  const state = loadState(workspaceRoot);
  const steeringContext = await loadSteeringContext(workspaceRoot);
  const graphifyContext = await loadGraphifyContext(workspaceRoot);

  let systemPrompt = buildSystemPrompt(state.phase, steeringContext, graphifyContext, state);

  // Injeta o mapa arquitetural nas fases de planejamento se existir
  if (state.specType === "refactor" && (state.phase === "REQUIREMENTS" || state.phase === "DESIGN")) {
    const mapPath = join(workspaceRoot, ".caramelo/architecture_map.md");
    if (existsSync(mapPath)) {
      const archMap = readFileSync(mapPath, "utf-8");
      systemPrompt += `\n\n## 🗺️ Mapa Arquitetural (Discovery Engine)\n${archMap}\n`;
    }
  }

  if (!output.system) output.system = [];
  output.system.push(systemPrompt);
}
