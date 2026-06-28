import { exec } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { Phase } from "../types";
import { logger } from "../utils/logger";

const execAsync = promisify(exec);

function getTestCommand(workspaceRoot: string): string | null {
  const packageJsonPath = join(workspaceRoot, "package.json");
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      if (pkg.scripts && pkg.scripts.test && !pkg.scripts.test.includes("no test specified")) {
        return "npm test";
      }
    } catch (e) {}
  }
  
  const pomPath = join(workspaceRoot, "pom.xml");
  if (existsSync(pomPath)) return "mvn clean test";
  
  const buildGradle = join(workspaceRoot, "build.gradle");
  if (existsSync(buildGradle)) return "gradle test";
  
  const goMod = join(workspaceRoot, "go.mod");
  if (existsSync(goMod)) return "go test ./...";
  
  return null;
}

export async function checkVerificationGate(workspaceRoot: string, input: any, output: any, phase: Phase) {
  if (phase !== "EXECUTING") return;

  const editTools = ["edit", "write", "patch", "multi_replace_file_content", "replace_file_content", "write_to_file"];
  if (!editTools.includes(input.tool)) return;

  const targetPath = output.args?.filePath || output.args?.file || output.args?.TargetFile || "";
  if (!targetPath.endsWith("tasks.md")) return;

  const replacement = output.args?.ReplacementContent || output.args?.content || output.args?.CodeContent || "";
  const absoluteTarget = join(workspaceRoot, targetPath);
  
  // Lê o arquivo atual para contar os [x]
  const currentContent = existsSync(absoluteTarget) ? readFileSync(absoluteTarget, "utf-8") : "";
  const currentXCount = (currentContent.match(/\[x\]/gi) || []).length;
  const newXCount = (replacement.match(/\[x\]/gi) || []).length;

  // Rota de escape fluida: Se o agente explicitamente declarou BYPASS_TESTS, nós confiamos.
  const inputStr = JSON.stringify(input.args || {});
  if (inputStr.includes("BYPASS_TESTS")) {
    logger.log("🐕 [CARAMELO] Verification Gate: Bypass acionado. Pulando testes.");
    return;
  }

  // SÓ VAMOS RODAR TESTES SE O NÚMERO DE [x] AUMENTOU
  // Evita rodar testes de 1 minuto toda vez que ele marca um [/] em andamento!
  if (newXCount > currentXCount) {
    const testCmd = getTestCommand(workspaceRoot);
    if (!testCmd) return; // Sem runner detectado, permite passar
    
    logger.log(`🐕 [CARAMELO] Verification Gate: Nova task concluída. Executando ${testCmd} em background...`);
    
    try {
      // 90 segundos de timeout (para projetos grandes)
      await execAsync(testCmd, { cwd: workspaceRoot, timeout: 60000 });
      logger.log(`🐕 [CARAMELO] Verification Gate: Testes passaram!`);
    } catch (error: any) {
      const stdout = error.stdout || "";
      const stderr = error.stderr || "";
      const msg = error.message || "";
      const combinedOutput = `${stdout}\\n${stderr}\\n${msg}`.substring(0, 1500);

      throw new Error(
        `🐕 [CARAMELO] VERIFICATION GATE BLOQUEADO (Testes Falharam):\n` +
        `Você tentou atualizar o tasks.md (marcando tasks como [x]), mas os testes do projeto falharam.\n\n` +
        `Comando executado pelo Guardrail: ${testCmd}\n` +
        `Output da falha:\n${combinedOutput}\n\n` +
        `PROIBIDO: Você NÃO pode marcar tasks como concluídas enquanto os testes falham.\n` +
        `Ação exigida: Cancele esta atualização, conserte o código que quebrou, e tente novamente.\n` +
        `> Se a task é SOMENTE documentação, ou os testes já estavam falhando no projeto antes de você começar, adicione a string "BYPASS_TESTS" na sua atualização do tasks.md junto a uma justificativa, e o sistema permitirá a gravação.`
      );
    }
  }
}
