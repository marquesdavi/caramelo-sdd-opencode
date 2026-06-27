import { readFileSync, existsSync } from "fs";

export interface ValidationResult {
  valid: boolean;
  checks: Array<{ name: string; test: boolean }>;
}

import { SpecType } from "../types";

export function validateRequirements(path: string, type: SpecType = "feature"): ValidationResult {
  if (!existsSync(path)) return { valid: false, checks: [{ name: "Arquivo existe", test: false }] };
  const content = readFileSync(path, "utf-8");
  
  let checks: { name: string; test: boolean }[] = [];
  
  if (type === "bugfix") {
    checks = [
      { name: "Arquivo existe", test: true },
      { name: "Tem Current Behavior", test: /(Current Behavior|Defect)/i.test(content) },
      { name: "Tem Expected Behavior", test: /(Expected Behavior|Correction)/i.test(content) },
    ];
  } else if (type === "refactor") {
    checks = [
      { name: "Arquivo existe", test: true },
      { name: "Tem Discovery Interview/Goal", test: /(Discovery Interview|Goal|Current State)/i.test(content) },
      { name: "Tem Behavioral Contract", test: /(Behavioral Contract|CONTINUE TO)/i.test(content) },
    ];
  } else {
    // feature
    checks = [
      { name: "Arquivo existe", test: true },
      { name: "Tem User Stories ou Requisitos", test: /(User Stor|Requisito)/i.test(content) },
      { name: "Tem EARS notation ou similar", test: /(WHEN|GIVEN|THE SYSTEM SHALL|Acceptance Criteria|Critérios)/i.test(content) },
    ];
  }
  
  return { valid: checks.every((c) => c.test), checks };
}

export function validateDesign(path: string): ValidationResult {
  if (!existsSync(path)) return { valid: false, checks: [{ name: "Arquivo existe", test: false }] };
  const content = readFileSync(path, "utf-8");
  const checks = [
    { name: "Arquivo existe", test: true },
    { name: "Tem seção de Arquitetura", test: /(Architecture|Arquitetura)/i.test(content) },
  ];
  return { valid: checks.every((c) => c.test), checks };
}

export function validateTasks(path: string): ValidationResult {
  if (!existsSync(path)) return { valid: false, checks: [{ name: "Arquivo existe", test: false }] };
  const content = readFileSync(path, "utf-8");
  const checks = [
    { name: "Arquivo existe", test: true },
    { name: "Tem lista de tarefas", test: /-\s*\[(\s|x)\]/i.test(content) },
  ];
  return { valid: checks.every((c) => c.test), checks };
}
