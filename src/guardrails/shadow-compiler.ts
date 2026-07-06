import { exec } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { Phase } from "../types";
import { logger } from "../utils/logger";

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
  if (existsSync(pomPath)) {
    if (existsSync(join(workspaceRoot, "mvnw"))) {
      return ["./mvnw clean compile"];
    }
    return ["mvn clean compile"];
  }
  
  const buildGradle = join(workspaceRoot, "build.gradle");
  if (existsSync(buildGradle)) {
    if (existsSync(join(workspaceRoot, "gradlew"))) {
      return ["./gradlew classes"];
    }
    return ["gradle classes"];
  }
  
  const goMod = join(workspaceRoot, "go.mod");
  // Para Go, 'go vet' (lint/analysis estático) é mais rápido que o build
  if (existsSync(goMod)) return ["go vet ./...", "go build ./..."];
  
  return [];
}

let isCompiling = false;
let sessionFailCount: Record<string, number> = {};

export function getSessionFailCount(sessionId: string): number {
  return sessionFailCount[sessionId] || 0;
}

export function resetSessionFailCount(sessionId: string): void {
  sessionFailCount[sessionId] = 0;
}

function semanticTruncate(text: string): string {
  if (text.length <= 500) return text;
  
  const lines = text.split('\n');
  const errorKeywords = ["[error]", "error:", "err!", "exception", "failed", "cannot find", "error ts"];
  
  let resultLines: string[] = [];
  let includeNextLines = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Remove ANSI escape codes (cores, bold, etc) e converte para lowercase
    const normalizedLine = line.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').toLowerCase();
    const isError = errorKeywords.some(kw => normalizedLine.includes(kw));
    
    if (isError) {
      resultLines.push(line);
      includeNextLines = 2; // Incluir contexto adjacente
    } else if (includeNextLines > 0 || (resultLines.length > 0 && (line.startsWith(' ') || line.startsWith('\t')))) {
      resultLines.push(line);
      if (includeNextLines > 0) includeNextLines--;
    }
    
    // Cap de Linhas (Edge Case C)
    if (resultLines.length >= 15) {
      resultLines.push("... (E mais dezenas de linhas de erro omitidas. Conserte a raiz do problema)");
      break;
    }
  }
  
  // Fallback (Edge Case B)
  if (resultLines.length === 0) {
    return text.substring(0, 250) + "\n...[TRUNCATED]...\n" + text.substring(text.length - 250);
  }
  
  return resultLines.join('\n');
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

  // Bypass via Tool Arguments (Edge Case D)
  const argsString = JSON.stringify(input.args || {});
  if (argsString.includes("BYPASS_COMPILER")) {
    logger.log("🐕 [CARAMELO] Shadow Compilation: Bypass acionado nos metadados. Pulando verificações.");
    return;
  }

  const pipeline = getFailFastPipeline(workspaceRoot);
  if (pipeline.length === 0) return; // Se não tem ferramentas detectadas, segue a vida

  // Mutex para Concorrência (Edge Case A)
  if (isCompiling) {
    logger.log("🐕 [CARAMELO] Build em andamento. Ignorando execução concorrente (Debounce).");
    return;
  }

  logger.log(`🐕 [CARAMELO] Pipeline Fail-Fast Ativado: ${pipeline.join(" -> ")}`);
  
  const sessionId = input.sessionID || "default";
  
  isCompiling = true;
  try {
    for (const cmd of pipeline) {
      try {
        logger.log(`🐕 [CARAMELO] Executando step: '${cmd}'...`);
        // Roda no background após a escrita
        await execAsync(cmd, { cwd: workspaceRoot, timeout: 45000 });
        logger.log(`🐕 [CARAMELO] Step '${cmd}' passou com sucesso!`);
        // Reset counter on success
        sessionFailCount[sessionId] = 0;
      } catch (error: any) {
        const stdout = error.stdout || "";
        const stderr = error.stderr || "";
        const combinedOutput = semanticTruncate(`${stdout}\n${stderr}`);

        const fails = (sessionFailCount[sessionId] || 0) + 1;
        sessionFailCount[sessionId] = fails;

        let msg = "";
        if (fails === 1) {
          // Context Cleanup - Mensagem longa apenas na primeira vez
          msg = `🐕 [CARAMELO] SHADOW COMPILATION REPORT (Pipeline Falhou no Step: ${cmd}):\n` +
            `A alteração que você fez no arquivo violou uma regra do projeto ou quebrou a compilação.\n\n` +
            `Comando que falhou: ${cmd}\n` +
            `Output da Ferramenta:\n${combinedOutput}\n\n` +
            `Ação exigida: CORRIJA o código no próximo tool call para que este step passe.\n` +
            `Checklist rápido: (1) Esqueceu um import? (2) Deixou código morto/duplicado? (3) Mudou assinatura sem atualizar os callers?\n` +
            `PROTOCOLO: Se esta edição faz parte de uma SEQUÊNCIA de edições interdependentes, insira [BYPASS_COMPILER] na Description das edições intermediárias. Só compile na última.`;
        } else {
          // Mensagem curta para falhas subsequentes (Evitar Context Rot)
          msg = `🐕 [CARAMELO] Falha no Build (${cmd}):\n${combinedOutput}\nANTES de editar, LEIA o arquivo com view_file para ver o estado real. Procure: imports faltando, código duplicado, métodos mortos.`;
        }

        try {
          if (client && input?.sessionID) {
            await client.session.prompt({
              path: { id: input.sessionID },
              body: {
                agent: "caramelo",
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
  } finally {
    isCompiling = false;
  }
}
