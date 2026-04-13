/**
 * POST /api/memory/dreams — Dream diary operations.
 *
 * Actions:
 *   { action: "read" }           → doctor.memory.dreamDiary
 *   { action: "backfill" }       → doctor.memory.backfillDreamDiary
 *   { action: "reset" }          → doctor.memory.resetDreamDiary
 *   { action: "resetShortTerm" } → doctor.memory.resetGroundedShortTerm
 *   { action: "repair" }         → doctor.memory.repairDreamingArtifacts
 *   { action: "dedupe" }         → doctor.memory.dedupeDreamDiary
 */
import { NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const ACTION_MAP: Record<
  string,
  keyof import("@/types/gateway-protocol.generated").GatewayMethodMap
> = {
  read: "doctor.memory.dreamDiary",
  backfill: "doctor.memory.backfillDreamDiary",
  reset: "doctor.memory.resetDreamDiary",
  resetShortTerm: "doctor.memory.resetGroundedShortTerm",
  repair: "doctor.memory.repairDreamingArtifacts",
  dedupe: "doctor.memory.dedupeDreamDiary",
};

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as { action?: string };
  const method = body.action ? ACTION_MAP[body.action] : undefined;

  if (!method) {
    return Response.json({ error: `unknown action "${body.action}"` }, { status: 400 });
  }

  return gwRequest(method, {});
});
