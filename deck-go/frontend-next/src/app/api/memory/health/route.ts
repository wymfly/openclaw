import { getRuntime } from "@server/runtime";
/**
 * GET /api/memory/health — Memory system health diagnostics.
 *
 * Calls `doctor.memory.status` RPC via the Gateway adapter.
 * Falls back to a basic status response when the Gateway doesn't support
 * the doctor endpoint.
 */
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { withAuth } from "@/lib/with-auth";

type HealthEntry = {
  agentId: string;
  provider: string;
  embeddingStatus: "ok" | "error" | "unknown";
  error?: string;
};

const DEFAULT_RUNTIME_ID = "rt_local";

async function localMemoryHealthGetHandler(_request: NextRequest) {
  try {
    const runtime = getRuntime();
    if (!runtime) {
      return NextResponse.json({ entries: [], lanceDbEnabled: false });
    }
    const data = await runtime.adapter.request("doctor.memory.status", {});
    // Gateway may return { entries: [...], lanceDbEnabled: boolean }
    if (data && typeof data === "object") {
      return NextResponse.json(data);
    }
    return NextResponse.json({ entries: [], lanceDbEnabled: false });
  } catch {
    // doctor.memory.status may not exist on older gateways — return empty.
    return NextResponse.json({
      entries: [] as HealthEntry[],
      lanceDbEnabled: false,
    });
  }
}

const guardedLocalMemoryHealthGetHandler = withAuth(localMemoryHealthGetHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/memory/health`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? { entries: [], lanceDbEnabled: false });
  }
  return guardedLocalMemoryHealthGetHandler(request);
}
