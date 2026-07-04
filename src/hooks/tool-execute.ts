import { loadState } from "../engine/state-machine";
import { checkVerificationGate } from "../guardrails/verification-gate";
import { createToolInterceptor } from "../guardrails/tool-interceptor";
import { checkCircuitBreaker, resetCircuitBreaker } from "../guardrails/circuit-breaker";
import { checkShadowCompilation } from "../guardrails/shadow-compiler";
import { checkWakeupCall } from "../guardrails/wakeup-call";
import { runRalphLoop } from "../engine/ralph-loop";
import { runCriticAgent } from "../engine/critic-agent";

export async function handleToolBefore(workspaceRoot: string, input: any, output: any, client: any) {
  const state = loadState(workspaceRoot);

  try {
    // 0. Trajectory Logging
    if (client && client.app) {
      try {
        const argsPreview = JSON.stringify(output.args || {}).substring(0, 150);
        await client.app.log({
          body: {
            service: "caramelo",
            level: "info",
            message: `[${state.phase}] Tool: ${input.tool} | Args: ${argsPreview}`
          }
        } as any);
      } catch (e) {
        // Ignorar erros de log
      }
    }

    // 1. Verification Gate (Run tests before marking [x] in tasks.md)
    await checkVerificationGate(workspaceRoot, input, output, state.phase);

    // 2. Tool Interceptors (Path traversal, Anti-shortcut, Restrições de spec)
    const interceptor = createToolInterceptor(workspaceRoot);
    await interceptor(input, output);

    // Se passou por todos os guardrails, reseta o circuit breaker
    resetCircuitBreaker();
  } catch (err: any) {
    await checkCircuitBreaker(workspaceRoot, err, client);
    throw err; // Repassa o erro se não estourou o limite do circuit breaker
  }
}

export async function handleToolAfter(workspaceRoot: string, input: any, output: any, client: any) {
  const state = loadState(workspaceRoot);

  try {
    // ─── Shadow Compilation (Fase 2) ───
    await checkShadowCompilation(workspaceRoot, input, output, state.phase, client);
  } catch (err: any) {
    throw err;
  }

  // Injeta o Wakeup Call via client.session.prompt (sem interromper a AI)
  await checkWakeupCall(workspaceRoot, state.phase, input, output, client);

  // ─── Ralph Loop (Stateless Task Loop) ───
  await runRalphLoop(workspaceRoot, state, input, client);

  // ─── Critic Agent (Quality Check) ───
  await runCriticAgent(workspaceRoot, state, input, client);
}
