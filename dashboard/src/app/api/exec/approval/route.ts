import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

/**
 * POST /api/exec/approval
 *
 * Relay a tool-execution approval decision to the Gateway.
 * Body: { id: string; decision: "allow-once" | "allow-always" | "deny" }
 */
export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as { id: string; decision: string };
  return gatewayRequest("exec.approval.resolve", {
    id: body.id,
    decision: body.decision,
  });
});
