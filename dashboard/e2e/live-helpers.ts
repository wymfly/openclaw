import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { APIRequestContext } from "@playwright/test";

export const liveSmokeEnabled = process.env.PLAYWRIGHT_LIVE_SMOKE === "1";
export const liveWecomEnabled = process.env.PLAYWRIGHT_LIVE_WECOM === "1";
export const gatewayUrl = process.env.PLAYWRIGHT_GATEWAY_URL ?? "ws://localhost:18789";

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
