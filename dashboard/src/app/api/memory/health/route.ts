/**
 * GET /api/memory/health — Memory system health diagnostics.
 *
 * Calls `doctor.memory.status` RPC via the Gateway adapter.
 * Falls back to a basic status response when the Gateway doesn't support
 * the doctor endpoint.
 */
import { NextResponse } from "next/server";
import { gwCall } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

type HealthEntry = {
  agentId: string;
  provider: string;
  embeddingStatus: "ok" | "error" | "unknown";
  error?: string;
};

export const GET = withAuth(async () => {
  try {
    const data = await gwCall("doctor.memory.status", {});
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
});
