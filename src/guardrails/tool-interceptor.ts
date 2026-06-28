import { loadState } from "../engine/state-machine";
import { resolve, normalize, extname, basename } from "path";
import { CARAMELO_DIR, SPECS_DIR, TEMPLATES_DIR } from "../types";

// Extensões de script "preguiçoso" que o agente não deve criar durante refatoração
const LAZY_SCRIPT_EXTENSIONS = [".py", ".rb", ".ps1"];

// Padrões de comando bash destrutivos: pipes para /dev/null
const DESTRUCTIVE_BASH_PATTERNS = [
  /\/dev\/null/,           // qualquer pipe para /dev/null
];

// Padrões de arquivos de teste que NÃO devem ser deletados
const TEST_FILE_PATTERNS = [
  /Test\.java$/i,
  /\.spec\.(ts|js|tsx|jsx)$/i,
  /\.test\.(ts|js|tsx|jsx)$/i,
  /_test\.go$/i,
  /Test\.kt$/i,
  /Spec\.rb$/i,
  /test_.*\.py$/i,
];

export function createToolInterceptor(workspaceRoot: string) {
  return async (input: any, output: any) => {
    const state = loadState(workspaceRoot);
    
    if (state.awaitingInitialInput) {
      throw new Error(
        `🐕 [CARAMELO] BLOQUEIO DETERMINÍSTICO:\n` +
        `Você AINDA NÃO PODE usar ferramentas (ler arquivos, rodar comandos ou editar) porque o usuário acabou de iniciar a spec e você precisa aguardar a explicação dele.\n` +
        `Sua ÚNICA tarefa agora é responder ao usuário no chat (fazendo as perguntas de escopo para começarmos) e aguardar a resposta dele.`
      );
    }

    const phase = state.phase;

    // ─── FASES DE SPEC: Bloqueia edição de código e restringe bash ───────────
    if (["REQUIREMENTS", "DESIGN", "TASKS"].includes(phase)) {
      const editTools = ["edit", "write", "patch", "multi_replace_file_content", "replace_file_content", "write_to_file"];
      if (editTools.includes(input.tool)) {
        const targetPath = output.args?.filePath || output.args?.file || output.args?.TargetFile || output.args?.AbsolutePath || "";
        const absoluteTarget = resolve(workspaceRoot, targetPath);
        const absoluteSpecsDir = resolve(workspaceRoot, CARAMELO_DIR, SPECS_DIR);
        const absoluteTemplatesDir = resolve(workspaceRoot, CARAMELO_DIR, TEMPLATES_DIR);
        const absoluteConfigFile = resolve(workspaceRoot, CARAMELO_DIR, "config.json");

        const isSpecFile = absoluteTarget.startsWith(absoluteSpecsDir);
        const isTemplateFile = absoluteTarget.startsWith(absoluteTemplatesDir);
        const isConfigFile = absoluteTarget === absoluteConfigFile;

        if (!isSpecFile && !isTemplateFile && !isConfigFile) {
          throw new Error(
            `🐕 [CARAMELO] Fase "${phase}": ` +
            `Edição de código BLOQUEADA. Segurança anti-path-traversal ativada. ` +
            `Finalize a spec antes de implementar!\n` +
            `Arquivo tentado: ${absoluteTarget}`
          );
        }

        if (isSpecFile) {
          const fileName = basename(absoluteTarget);
          if (phase === "REQUIREMENTS") {
            if (fileName === "design.md" || fileName === "tasks.md") {
              throw new Error(
                `🐕 [CARAMELO] ANTI-RUSH BLOQUEADO — Fase "REQUIREMENTS":\n` +
                `Você está tentando escrever o arquivo '${fileName}' prematuramente.\n` +
                `Nesta fase, você só tem permissão para escrever o requirements.md ou bugfix.md.\n` +
                `Se você já concluiu os requisitos, PARE E PERGUNTE ao humano se pode avançar para a fase DESIGN.`
              );
            }
          } else if (phase === "DESIGN") {
            if (fileName === "tasks.md") {
              throw new Error(
                `🐕 [CARAMELO] ANTI-RUSH BLOQUEADO — Fase "DESIGN":\n` +
                `Você está tentando escrever o arquivo '${fileName}' prematuramente.\n` +
                `Nesta fase, você só tem permissão para escrever o design.md (e ajustar requirements.md se necessário).\n` +
                `Se você já concluiu o design arquitetural, PARE E PERGUNTE ao humano se pode avançar para a fase TASKS.`
              );
            }
          }
        }

      }

      if (input.tool === "run_command" || input.tool === "bash") {
        const cmd = output.args?.command || output.args?.CommandLine || "";
        const commandBase = cmd.trim().split(" ")[0];
        const allowedCommands = ["ls", "cat", "grep", "find", "pwd", "git", "echo"];
        
        if (!allowedCommands.includes(commandBase)) {
          // Permite comandos de edição via bash APENAS se estiverem manipulando arquivos da spec
          const isTargetingSpec = cmd.includes(".caramelo/specs/");
          const isTargetingSource = cmd.includes("src/") || cmd.includes("pom.xml") || cmd.includes("package.json") || cmd.includes("main/");
          
          if (!isTargetingSpec || isTargetingSource) {
            throw new Error(
              `🐕 [CARAMELO] Fase "${phase}": ` +
              `Comando "${commandBase}" não autorizado.\n` +
              `Apenas comandos analíticos são permitidos, a menos que você esteja editando um arquivo em '.caramelo/specs/'.`
            );
          }
        }
      }
    }

    // ─── FASE EXECUTING: Bloqueia edição de specs (apenas tasks.md) ──────────
    if (phase === "EXECUTING") {
      const editTools = ["edit", "write", "patch", "multi_replace_file_content", "replace_file_content", "write_to_file"];
      
      if (editTools.includes(input.tool)) {
        const targetPath = output.args?.filePath || output.args?.file || output.args?.TargetFile || output.args?.AbsolutePath || "";
        const absoluteTarget = resolve(workspaceRoot, targetPath);
        const absoluteSpecsDir = resolve(workspaceRoot, CARAMELO_DIR, SPECS_DIR);
        
        // Specs são READ-ONLY durante execução (exceto tasks.md)
        if (absoluteTarget.startsWith(absoluteSpecsDir) && !absoluteTarget.endsWith("tasks.md")) {
          throw new Error(
            `🐕 [CARAMELO] Fase "EXECUTING": ` +
            `Specs (requirements e design) são READ-ONLY durante a execução.\n` +
            `Use a fase correta se precisar alterar a arquitetura.`
          );
        }

        // ── Anti-Shortcut #1: Bloqueia criação de scripts "preguiçosos" ──────
        // Scripts .sh são permitidos SOMENTE se existirem na spec do projeto
        const ext = extname(absoluteTarget).toLowerCase();
        if (LAZY_SCRIPT_EXTENSIONS.includes(ext)) {
          throw new Error(
            `🐕 [CARAMELO] ANTI-SHORTCUT BLOQUEADO — Fase "EXECUTING":\n` +
            `Tentativa de criar arquivo "${basename(absoluteTarget)}" (${ext}).\n` +
            `Scripts auxiliares em linguagem diferente da do projeto são PROIBIDOS durante refatoração/bugfix.\n` +
            `Corrija o código-fonte diretamente ao invés de criar scripts de contorno.\n` +
            `Se realmente necessário, peça aprovação explícita ao humano primeiro.`
          );
        }

        // ── Anti-Shortcut #2: Bloqueia deleção/modificação de arquivos de teste ─
        const isTestFile = TEST_FILE_PATTERNS.some(pattern => pattern.test(absoluteTarget));
        if (isTestFile) {
          // Permite apenas leitura via grep/cat — edição de testes requer aprovação
          // Nota: editar testes para corrigir assinaturas é legítimo, mas deve ser declarado.
          // Por hora, lançamos warning mas não bloqueamos hard — o prompt ProhibitedActions cobre isso.
          console.warn(
            `🐕 [CARAMELO] AVISO: Tentativa de editar arquivo de teste: ${basename(absoluteTarget)}\n` +
            `Certifique-se de que esta edição é necessária e documente o motivo conforme o VerificationProtocol.`
          );
        }
      }

      // ── Anti-Shortcut #3: Bloqueia bash destrutivo ────────────────────────
      if (input.tool === "run_command" || input.tool === "bash") {
        const cmd = output.args?.command || output.args?.CommandLine || "";

        for (const pattern of DESTRUCTIVE_BASH_PATTERNS) {
          if (pattern.test(cmd)) {
            throw new Error(
              `🐕 [CARAMELO] ANTI-SHORTCUT BLOQUEADO — Fase "EXECUTING":\n` +
              `Comando bash destrutivo detectado: "${cmd.substring(0, 100)}"\n` +
              `Padrão bloqueado: ${pattern.toString()}\n` +
              `Substituições em massa via sed/awk/perl/tr são PROIBIDAS — edite os arquivos diretamente.\n` +
              `Pipes para /dev/null são PROIBIDOS — execute o comando sem suprimir output.`
            );
          }
        }

        // ── Anti-Shortcut #4: Bloqueia rm em arquivos de teste ───────────────
        const rmTestPattern = /\brm\b.*\.(java|ts|js|tsx|jsx|kt|go|rb|py)\b/;
        if (rmTestPattern.test(cmd)) {
          throw new Error(
            `🐕 [CARAMELO] ANTI-SHORTCUT BLOQUEADO — Fase "EXECUTING":\n` +
            `Tentativa de deletar arquivo de código/teste via rm: "${cmd.substring(0, 100)}"\n` +
            `Deleção de arquivos de código-fonte requer aprovação explícita do humano.\n` +
            `Se este arquivo deve ser removido, documente no tasks.md e peça aprovação.`
          );
        }
      }
    }
  };
}
