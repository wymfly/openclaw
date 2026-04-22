import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { APIRequestContext } from "@playwright/test";
import { GatewayClient } from "../../../src/gateway/client";
import {
  GATEWAY_CLIENT_MODES,
  GATEWAY_CLIENT_NAMES,
} from "../../../src/gateway/protocol/client-info";

export const liveSmokeEnabled = process.env.PLAYWRIGHT_LIVE_SMOKE === "1";
export const liveWecomEnabled = process.env.PLAYWRIGHT_LIVE_WECOM === "1";
export const gatewayUrl = process.env.PLAYWRIGHT_GATEWAY_URL ?? "ws://localhost:18789";
export const deckGoApiBase =
  process.env.PLAYWRIGHT_DECK_GO_API_BASE ??
  process.env.NEXT_PUBLIC_DECK_GO_API_BASE ??
  "http://127.0.0.1:19566";

export function resolveGatewayToken(): string | null {
  const envToken = process.env.OPENCLAW_GATEWAY_TOKEN?.trim();
  if (envToken) {
    return envToken;
  }

  try {
    const configPath = path.join(os.homedir(), ".openclaw", "openclaw.json");
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as {
      gateway?: { auth?: { token?: string } };
    };
    const configToken = parsed.gateway?.auth?.token?.trim();
    return configToken || null;
  } catch {
    return null;
  }
}

export async function isDashboardServerReachable(request: APIRequestContext): Promise<boolean> {
  try {
    const response = await request.get("/", {
      failOnStatusCode: false,
      timeout: 3_000,
    });
    return response.status() > 0;
  } catch {
    return false;
  }
}

export async function isDeckGoServerReachable(request: APIRequestContext): Promise<boolean> {
  try {
    const response = await request.get(`${deckGoApiBase}/api/runtime/gateway`, {
      failOnStatusCode: false,
      timeout: 3_000,
    });
    return response.status() > 0;
  } catch {
    return false;
  }
}

export async function connectLiveGatewayClient(displayName: string): Promise<GatewayClient> {
  const token = resolveGatewayToken();
  if (!token) {
    throw new Error("gateway token is required for live Gateway client connections");
  }
  return await new Promise<GatewayClient>((resolve, reject) => {
    let settled = false;
    const client = new GatewayClient({
      url: gatewayUrl,
      token,
      clientName: GATEWAY_CLIENT_NAMES.TEST,
      clientDisplayName: displayName,
      clientVersion: "dev",
      mode: GATEWAY_CLIENT_MODES.TEST,
      connectChallengeTimeoutMs: 15_000,
      onHelloOk: () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(client);
      },
      onConnectError: (error) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(error);
      },
      onClose: (code, reason) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(new Error(`gateway closed during connect (${code}): ${reason}`));
      },
    });
    client.start();
  });
}
