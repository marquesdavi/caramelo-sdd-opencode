export type Phase = "IDLE" | "REQUIREMENTS" | "DESIGN" | "TASKS" | "EXECUTING";
export type SpecType = "feature" | "bugfix" | "refactor";

export interface TaskState {
  total: number;
  completed: number;
  current: string | null;
  lastCompactedAtTask?: number;
  needsCompaction?: boolean;
  compactionSessionId?: string;
}

export interface State {
  version: string;
  phase: Phase;
  specType: SpecType;
  activeSpec: string | null;
  specDir: string | null;
  awaitingInitialInput?: boolean;
  tasks: TaskState;
  history: Array<{
    phase: Phase;
    approved_at: string;
  } | string>;
}

export const CARAMELO_DIR = ".caramelo";
export const STEERING_DIR = "steering";
export const SPECS_DIR = "specs";
export const TEMPLATES_DIR = "templates";
export const CONFIG_FILE = "config.json";
