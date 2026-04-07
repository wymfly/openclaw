import { getAccessToken } from "./transport/agent-api/core.js";
import type { ResolvedWecomAccount } from "./types/index.js";

export type WecomProbeResult = {
  ok: boolean;
  error?: string;
  elapsedMs: number;
  agentId?: number;
  transport?: string;
};

export async function probeWecomAccount(params: {
  account: ResolvedWecomAccount;
  timeoutMs?: number;
}): Promise<WecomProbeResult> {
  const { account, timeoutMs = 2500 } = params;
  const start = Date.now();

  // Bot-only WS account: config presence is sufficient (WS connection managed by runtime)
  if (!account.agent?.configured && account.bot?.configured) {
    return {
      ok: true,
      elapsedMs: Date.now() - start,
      transport: account.bot.primaryTransport,
    };
  }

  // Agent account: verify credentials by getting an access token
  if (!account.agent?.apiConfigured) {
    return {
      ok: false,
      error: "Agent API not configured for probe",
      elapsedMs: Date.now() - start,
    };
  }

  try {
    const tokenPromise = getAccessToken(account.agent);
    const token = await Promise.race([
      tokenPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("probe timeout")), timeoutMs),
      ),
    ]);
    if (!token) {
      return { ok: false, error: "empty access token", elapsedMs: Date.now() - start };
    }
    return {
      ok: true,
      elapsedMs: Date.now() - start,
      agentId: account.agent.agentId,
      transport: account.bot?.primaryTransport ?? "agent-callback",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - start,
    };
  }
}
