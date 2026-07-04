import { loadState } from "../engine/state-machine";
import { buildCarameloAgent } from "../config/agent";

export function handleConfig(workspaceRoot: string, input: any) {
  const state = loadState(workspaceRoot);
  if (!input.agent) input.agent = {};
  input.agent["caramelo"] = buildCarameloAgent(state.phase, state) as any;

  if (!input.command) input.command = {};
  input.command["caramelo status"] = { template: "/caramelo status", description: "Mostra a fase atual e as tasks pendentes do SDD.", agent: "caramelo" };
  input.command["caramelo next"] = { template: "/caramelo next", description: "Aprova a fase atual e avança para a próxima.", agent: "caramelo" };
  input.command["caramelo skip"] = { template: "/caramelo skip", description: "Ignora a fase atual e pula diretamente para a próxima.", agent: "caramelo" };
  input.command["caramelo reset"] = { template: "/caramelo reset", description: "Cancela o SDD atual e volta para a fase IDLE.", agent: "caramelo" };
  input.command["caramelo feature"] = { template: "/caramelo feature ", description: "Inicia uma nova spec de Feature. Digite o nome em seguida.", agent: "caramelo" };
  input.command["caramelo bugfix"] = { template: "/caramelo bugfix ", description: "Inicia uma nova spec de Bugfix. Digite o nome em seguida.", agent: "caramelo" };
  input.command["caramelo refactor"] = { template: "/caramelo refactor ", description: "Inicia uma spec de Refactoring Seguro. Digite o nome em seguida.", agent: "caramelo" };
}
