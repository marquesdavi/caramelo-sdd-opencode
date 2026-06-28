import { Phase } from "../types";

// Tipagem real do SDK (https://opencode.ai/docs/agents/#permissions)
// Keys que suportam glob patterns: read, edit, glob, grep, list, bash, task, external_directory, lsp, skill
// Keys shorthand only: todowrite, todoread, webfetch, websearch, question, doom_loop
type PermissionActionConfig = "allow" | "ask" | "deny";
type PermissionRuleConfig = PermissionActionConfig | { [key: string]: PermissionActionConfig };

export interface PhaseConfig {
  model: string;
  temperature: number;
  permissions: {
    read?: PermissionRuleConfig;
    edit?: PermissionRuleConfig;
    bash?: PermissionRuleConfig;
    glob?: PermissionRuleConfig;
    grep?: PermissionRuleConfig;
    list?: PermissionRuleConfig;
    task?: PermissionRuleConfig;
    webfetch?: PermissionActionConfig;
    websearch?: PermissionActionConfig;
  };
}

export const PHASE_CONFIGS: Record<Phase, PhaseConfig> = {
  IDLE: {
    model: "deepseek/deepseek-v4-flash",
    temperature: 0.3,
    permissions: {
      read: "allow",
      edit: "allow",
      bash: {
        "*": "ask",
        "ls *": "allow", "cat *": "allow", "grep *": "allow",
        "find *": "allow", "pwd": "allow",
        "git status*": "allow", "git log*": "allow", "git diff*": "allow", "git show*": "allow",
        "git *": "ask",
      },
      glob: "allow",
      grep: "allow",
      list: "allow",
    },
  },
  REQUIREMENTS: {
    model: "deepseek/deepseek-v4-flash",
    temperature: 0.3,
    permissions: {
      read: "allow",
      edit: "allow",
      bash: {
        "*": "allow",
        "ls *": "allow", "cat *": "allow", "grep *": "allow",
        "find *": "allow", "pwd": "allow",
      },
      glob: "allow",
      grep: "allow",
      list: "allow",
    },
  },
  DESIGN: {
    model: "deepseek/deepseek-v4-pro",
    temperature: 0.1,
    permissions: {
      read: "allow",
      edit: "allow",
      bash: {
        "*": "allow",
        "ls *": "allow", "cat *": "allow", "grep *": "allow",
        "find *": "allow", "pwd": "allow",
      },
      glob: "allow",
      grep: "allow",
      list: "allow",
    },
  },
  TASKS: {
    model: "deepseek/deepseek-v4-flash",
    temperature: 0.0,
    permissions: {
      read: "allow",
      edit: "allow",
      bash: {
        "*": "allow",
        "ls *": "allow", "cat *": "allow", "grep *": "allow",
        "find *": "allow", "pwd": "allow",
      },
      glob: "allow",
      grep: "allow",
      list: "allow",
    },
  },
  EXECUTING: {
    model: "deepseek/deepseek-v4-pro",
    temperature: 0.2,
    permissions: {
      read: "allow",
      edit: "allow",
      bash: {
        "*": "ask",
        "ls *": "allow", "cat *": "allow", "grep *": "allow",
        "find *": "allow", "pwd": "allow",
        "git status*": "allow", "git log*": "allow", "git diff*": "allow", "git show*": "allow",
        "git *": "ask",
        "npm *": "allow", "npx *": "allow",
        "bun *": "allow",
        "rm *": "deny", "sudo *": "deny",
      },
      glob: "allow",
      grep: "allow",
      list: "allow",
    },
  },
};
