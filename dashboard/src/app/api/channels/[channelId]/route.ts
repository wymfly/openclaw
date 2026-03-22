/**
 * /api/channels/[channelId] — Single channel config operations.
 *
 * PATCH — Update channel configuration
 *
 * Channel config lives in openclaw.json. To update:
 *   1. Read current config via config.get
 *   2. Merge channel changes into the channels section
 *   3. Send full config via config.patch with baseHash
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ channelId: string }> };

export const PATCH = withAuth(async (request: NextRequest, ctx: unknown) => {
  const { channelId } = await (ctx as RouteContext).params;
  const body = (await request.json()) as Record<string, unknown>;
  const { accountId, ...patch } = body;

  // 1. Read current config
  const configRes = await gatewayRequest("config.get", {});
  if (configRes.status !== 200) {
    return configRes;
  }
  const configData = (await configRes.json()) as {
    config?: Record<string, unknown>;
    baseHash?: string;
  };

  const config = configData.config ?? {};
  const baseHash = configData.baseHash;

  // 2. Merge channel changes (account-scoped when accountId is provided)
  const channels = (config.channels ?? {}) as Record<string, Record<string, unknown>>;
  if (typeof accountId === "string" && accountId) {
    const channelCfg = channels[channelId] ?? {};
    const accounts = (channelCfg.accounts ?? {}) as Record<string, Record<string, unknown>>;
    accounts[accountId] = { ...accounts[accountId], ...patch };
    channelCfg.accounts = accounts;
    channels[channelId] = channelCfg;
  } else {
    channels[channelId] = { ...channels[channelId], ...patch };
  }
  config.channels = channels;

  // 3. Send full config via config.patch
  return gatewayRequest("config.patch", {
    raw: JSON.stringify(config, null, 2),
    ...(baseHash ? { baseHash } : {}),
  });
});
