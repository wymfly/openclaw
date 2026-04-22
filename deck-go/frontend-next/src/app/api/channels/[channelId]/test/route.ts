/**
 * POST /api/channels/[channelId]/test — Run a channel connectivity check.
 *
 * This route intentionally performs a probe-based connectivity check.
 * It does not claim to deliver a real outbound message unless a future
 * channel-specific send-test contract exists.
 */
import { type NextRequest, NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwCall, gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ channelId: string }> };
const DEFAULT_RUNTIME_ID = "rt_local";

async function localChannelTestPostHandler(request: NextRequest, ctx: unknown) {
  const { channelId } = await (ctx as RouteContext).params;
  await request.json().catch(() => ({}));
  const start = Date.now();

  try {
    const probeData = (await gwCall("channels.status", { probe: true })) as Record<string, unknown>;
    const latencyMs = Date.now() - start;
    const allAccounts = (probeData?.channelAccounts ?? {}) as Record<
      string,
      Array<{ probe?: { ok?: boolean; error?: string; latencyMs?: number; elapsedMs?: number } }>
    >;
    const channelAccounts = Array.isArray(allAccounts[channelId]) ? allAccounts[channelId] : [];
    const anyOk = channelAccounts.some((account) => account.probe?.ok === true);
    const firstError = channelAccounts.find((account) => account.probe?.error)?.probe?.error;

    if (anyOk) {
      return NextResponse.json({
        ok: true,
        channelId,
        check: "probe",
        latencyMs,
        checkedAt: Date.now(),
      });
    }

    return NextResponse.json(
      {
        ok: false,
        channelId,
        check: "probe",
        error: firstError ?? `Channel ${channelId} did not pass connectivity probe`,
        latencyMs,
      },
      { status: 502 },
    );
  } catch (err) {
    if (err instanceof Error) {
      const fallback = await gwRequest("channels.status", { probe: true });
      if (!fallback.ok) {
        const errorBody = (await fallback.json().catch(() => null)) as {
          error?: string;
          code?: string;
        } | null;
        return NextResponse.json(
          {
            ok: false,
            channelId,
            check: "probe",
            error: errorBody?.error ?? err.message,
            code: errorBody?.code,
            latencyMs: Date.now() - start,
          },
          { status: fallback.status },
        );
      }
    }
    return NextResponse.json(
      {
        ok: false,
        channelId,
        check: "probe",
        error: err instanceof Error ? err.message : "Test failed",
        latencyMs: Date.now() - start,
      },
      { status: 500 },
    );
  }
}

const guardedLocalChannelTestPostHandler = withAuth(localChannelTestPostHandler);

export async function POST(request: NextRequest, ctx: unknown) {
  const { channelId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/channels/${encodeURIComponent(
      channelId,
    )}/test`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalChannelTestPostHandler(request, ctx);
}
