import { exec } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { Phase } from "../types";

const execAsync = promisify(exec);

export function getCompilerCommand(workspaceRoot: string): string | null {
  const packageJsonPath = join(workspaceRoot, "package.json");
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      // Em Projetos Angular/React/Vite, 'build' geralmente roda o tsc antes
      if (pkg.scripts && pkg.scripts.build) {
        return "npm run build";
      }
      // Se não tem script de build explícito, mas é TypeScript
      if (existsSync(join(workspaceRoot, "tsconfig.json"))) {
        return "npx tsc --noEmit";
      }
    } catch (e) {}
  }
  
  const pomPath = join(workspaceRoot, "pom.xml");
  if (existsSync(pomPath)) return "mvn clean compile";
  
  const buildGradle = join(workspaceRoot, "build.gradle");
  if (existsSync(buildGradle)) return "gradle classes";
  
  const goMod = join(workspaceRoot, "go.mod");
  if (existsSync(goMod)) return "go build ./...";
  
  return null;
}

export async function checkShadowCompilation(workspaceRoot: string, input: any, output: any, phase: Phase) {
  // Shadow compilation só é restritiva em EXECUTING
  if (phase !== "EXECUTING") return;

  const editTools = ["edit", "write", "patch", "multi_replace_file_content", "replace_file_content", "write_to_file"];
  if (!editTools.includes(input.tool)) return;

  const targetPath = (input.args?.filePath || input.args?.file || input.args?.TargetFile || "").toLowerCase();
  
  // Ignora arquivos do Caramelo, configs, testes e documentações
  if (!targetPath || 
      targetPath.includes(".caramelo") || 
      targetPath.endsWith(".md") || 
      targetPath.endsWith(".json") || 
      targetPath.includes("test") ||
      targetPath.includes("spec")) {
    return;
  }

  // Se o agente explícitamente fez BYPASS, nós respeitamos
  const replacement = input.args?.ReplacementContent || input.args?.content || input.args?.CodeContent || "";
  if (replacement.includes("BYPASS_COMPILER")) {
    console.log("🐕 [CARAMELO] Shadow Compilation: Bypass acionado. Pulando compilador.");
    return;
  }

  const compilerCmd = getCompilerCommand(workspaceRoot);
  if (!compilerCmd) return; // Se não tem compilador tipado, segue a vida

  console.log(`🐕 [CARAMELO] Shadow Compilation: Verificando integridade de código com '${compilerCmd}'...`);
  
  try {
    // Roda o compilador no background após a escrita (em Node, exec já é silencioso pro processo principal)
    // Usamos um timeout razoável para build (45s)
    await execAsync(compilerCmd, { cwd: workspaceRoot, timeout: 45000 });
    console.log(`🐕 [CARAMELO] Shadow Compilation: Build perfeitamente íntegro!`);
  } catch (error: any) {
    const stdout = error.stdout || "";
    const stderr = error.stderr || "";
    const combinedOutput = `${stdout}\\n${stderr}`.substring(0, 1500);

    throw new Error(
      `🐕 [CARAMELO] SHADOW COMPILATION BLOQUEOU SUA EDIÇÃO (Erro de Sintaxe / Mapeamento):\n` +
      `A alteração que você fez no arquivo quebrou a compilação do projeto.\n\n` +
      `Comando executado pelo Guardrail: ${compilerCmd}\n` +
      `Output do Compilador:\n${combinedOutput}\n\n` +
      `Ação exigida: CORRIJA o código no próximo tool call para que ele volte a compilar.\n` +
      `Dica YAGNI: Você inventou um método que não existe? Você alterou a assinatura de uma função sem atualizar quem chama?\n` +
      `> Se você sabe que o build ficará quebrado temporariamente porque está no meio de uma refatoração em cadeia, coloque o comentário "BYPASS_COMPILER" no código da sua edição para autorizar o bloqueio.`
    );
  }
}
