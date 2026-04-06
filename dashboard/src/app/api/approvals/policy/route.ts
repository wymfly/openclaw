/**
 * /api/approvals/policy — Read and update approval policy.
 *
 * GET → exec.approvals.get {} → { path, exists, hash, file: ExecApprovalsFile }
 * PUT → exec.approvals.set { file, baseHash } → updated snapshot
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import type { GatewayMethodMap } from "@/types/gateway-protocol.generated";

export const GET = withAuth(async () => {
  return gwRequest("exec.approvals.get", {});
});

export const PUT = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as { file: unknown; baseHash?: string };
  return gwRequest("exec.approvals.set", {
    file: body.file,
    ...(body.baseHash ? { baseHash: body.baseHash } : {}),
  } as GatewayMethodMap["exec.approvals.set"]["params"]);
});
