/**
 * /api/channels/[channelId] — Single channel config operations.
 *
 * PATCH — Update channel configuration
 *
 * Channel config lives in openclaw.json. To update:
 *   1. Read current config via config.get
 *   2. Send only the channel subtree patch via config.patch
 *      so nested account updates preserve sibling config.
 */
import { type NextRequest } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ channelId: string }> };
const DEFAULT_RUNTIME_ID = "rt_local";

async function localChannelPatchHandler(request: NextRequest, ctx: unknown) {
  const { channelId } = await (ctx as RouteContext).params;
  const patch = (await request.json()) as Record<string, unknown>;

  // 1. Read current config
  const configRes = await gwRequest("config.get", {});
  if (configRes.status !== 200) {
    return configRes;
  }
  const configData = (await configRes.json()) as {
    config?: Record<string, unknown>;
    baseHash?: string;
  };

  const config = configData.config ?? {};
  const baseHash = configData.baseHash;
  if (!config || typeof config !== "object") {
    return configRes;
  }

  // 2. Send only the channel subtree patch so Gateway-side merge-patch keeps
  // nested account config intact instead of replacing sibling branches.
  return gwRequest("config.patch", {
    raw: JSON.stringify(
      {
        channels: {
          [channelId]: patch,
        },
      },
      null,
      2,
    ),
    ...(baseHash ? { baseHash } : {}),
  });
}

const guardedLocalChannelPatchHandler = withAuth(localChannelPatchHandler);

export async function PATCH(request: NextRequest, ctx: unknown) {
  const { channelId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/channels/${encodeURIComponent(
      channelId,
    )}`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalChannelPatchHandler(request, ctx);
}
