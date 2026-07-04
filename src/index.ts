import { Plugin } from "@opencode-ai/plugin";
import { detectOrInitCaramelo } from "./utils/detection";
import { initLogger } from "./utils/logger";
import { handleConfig } from "./hooks/config";
import { handleSystemTransform } from "./hooks/system-transform";
import { handleChatMessage } from "./hooks/chat-message";
import { handleToolBefore, handleToolAfter } from "./hooks/tool-execute";
import { handleSessionCompacting, handleEvent } from "./hooks/session-compacting";

export const CarameloPlugin: Plugin = async ({ directory, client }) => {
  const workspaceRoot = directory;
  initLogger(workspaceRoot);

  if (!detectOrInitCaramelo(workspaceRoot)) {
    return {};
  }

  return {
    config: async (input) => handleConfig(workspaceRoot, input),
    
    "experimental.chat.system.transform": async (input, output) => 
      handleSystemTransform(workspaceRoot, input, output),
      
    "chat.message": async (input, output) => 
      handleChatMessage(workspaceRoot, input, output, client),
      
    "tool.execute.before": async (input, output) => 
      handleToolBefore(workspaceRoot, input, output, client),
      
    "tool.execute.after": async (input, output) => 
      handleToolAfter(workspaceRoot, input, output, client),
      
    "experimental.session.compacting": async (input, output) => 
      handleSessionCompacting(workspaceRoot, input, output),
      
    event: async ({ event }) => 
      handleEvent(workspaceRoot, event, client)
  };
};

export default CarameloPlugin;
