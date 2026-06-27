import { readFileSync, existsSync } from "fs";
import { TaskState } from "../types";

export function parseTaskState(tasksFilePath: string): TaskState {
  if (!existsSync(tasksFilePath)) {
    return { total: 0, completed: 0, current: null };
  }

  const content = readFileSync(tasksFilePath, "utf-8");
  const lines = content.split("\n");

  let total = 0;
  let completed = 0;
  let current: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- [ ]") || trimmed.startsWith("- [x]") || trimmed.startsWith("- [X]") || trimmed.startsWith("- [/]") || trimmed.startsWith("- [-]")) {
      total++;
      if (trimmed.startsWith("- [x]") || trimmed.startsWith("- [X]")) {
        completed++;
      } else if (trimmed.startsWith("- [/]") || trimmed.startsWith("- [-]")) {
        // Marca que está em andamento, mas ainda não completa. Pode capturar como 'current'
        if (!current) current = trimmed.substring(5).trim();
      } else if (!current) {
        current = trimmed.substring(5).trim();
      }
    }
  }

  return { total, completed, current };
}
