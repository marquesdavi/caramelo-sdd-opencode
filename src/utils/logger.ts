import { appendFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

let _workspaceRoot = "";

export function initLogger(workspaceRoot: string) {
  _workspaceRoot = workspaceRoot;
}

export const logger = {
  log: (message: string) => {
    if (!_workspaceRoot) return;
    try {
      const dir = join(_workspaceRoot, ".caramelo");
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const logPath = join(dir, "caramelo-plugin.log");
      const timestamp = new Date().toISOString();
      appendFileSync(logPath, `[${timestamp}] ${message}\n`);
    } catch (e) {
      // Ignora falhas de escrita
    }
  },
  error: (message: string) => {
    logger.log(`[ERROR] ${message}`);
  }
};
