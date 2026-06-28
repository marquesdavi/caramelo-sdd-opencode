import { exec } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { Phase } from "../types";

const execAsync = promisify(exec);

export function getFailFastPipeline(workspaceRoot: string): string[] {
  const pipeline: string[] = [];
  
  const packageJsonPath = join(workspaceRoot, "package.json");
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      // 1. Step mais barato: Lint
      if (pkg.scripts && pkg.scripts.lint) {
        pipeline.push("npm run lint");
      }
      // 2. Step intermediário/caro: Build / Typecheck
      if (pkg.scripts && pkg.scripts.build) {
        pipeline.push("npm run build");
      } else if (existsSync(join(workspaceRoot, "tsconfig.json"))) {
        pipeline.push("npx tsc --noEmit");
      }
      
      if (pipeline.length > 0) return pipeline;
    } catch (e) {}
  }
  
  const pomPath = join(workspaceRoot, "pom.xml");
  if (existsSync(pomPath)) return ["mvn clean compile"];
  
  const buildGradle = join(workspaceRoot, "build.gradle");
  if (existsSync(buildGradle)) return ["gradle classes"];
  
  const goMod = join(workspaceRoot, "go.mod");
  // Para Go, 'go vet' (lint/analysis estático) é mais rápido que o build
  if (existsSync(goMod)) return ["go vet ./...", "go build ./..."];
  
  return [];
}

export async function checkShadowCompilation(workspaceRoot: string, input: any, output: any, phase: Phase, client?: any) {
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
    console.log("🐕 [CARAMELO] Shadow Compilation: Bypass acionado. Pulando verificações.");
    return;
  }

  const pipeline = getFailFastPipeline(workspaceRoot);
  if (pipeline.length === 0) return; // Se não tem ferramentas detectadas, segue a vida

  console.log(`🐕 [CARAMELO] Pipeline Fail-Fast Ativado: ${pipeline.join(" -> ")}`);
  
  for (const cmd of pipeline) {
    try {
      console.log(`🐕 [CARAMELO] Executando step: '${cmd}'...`);
      // Roda no background após a escrita (em Node, exec já é silencioso pro processo principal)
      await execAsync(cmd, { cwd: workspaceRoot, timeout: 45000 });
      console.log(`🐕 [CARAMELO] Step '${cmd}' passou com sucesso!`);
    } catch (error: any) {
      const stdout = error.stdout || "";
      const stderr = error.stderr || "";
      const combinedOutput = `${stdout}\\n${stderr}`.substring(0, 1500);

      const msg = `🐕 [CARAMELO] SHADOW COMPILATION REPORT (Pipeline Falhou no Step: ${cmd}):\n` +
        `A alteração que você fez no arquivo violou uma regra do projeto ou quebrou a compilação.\n\n` +
        `Comando que falhou: ${cmd}\n` +
        `Output da Ferramenta:\n${combinedOutput}\n\n` +
        `Ação exigida: CORRIJA o código no próximo tool call para que este step passe.\n` +
        `Dica YAGNI: Você esqueceu um import? Declarou variável sem usar? Modificou a assinatura de uma função sem alterar quem chama?\n` +
        `> Se você sabe que a compilação ficará quebrada temporariamente porque está no meio de uma refatoração em cadeia, coloque o comentário "BYPASS_COMPILER" no código da sua edição.`;

      try {
        if (client && input?.sessionID) {
          await client.session.prompt({
            path: { id: input.sessionID },
            body: {
              noReply: true,
              parts: [{ type: "text", text: msg }]
            }
          });
        }
      } catch (e) {
        // Fallback: anexa ao output
        if (output && typeof output.output === "string") {
          output.output += `\n\n${msg}`;
        }
      }
      
      // Stop the pipeline on the first failure (Fail-Fast)
      break;
    }
  }
}
