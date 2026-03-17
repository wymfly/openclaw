/**
 * /api/approvals/policy — Read and update approval policy.
 *
 * GET → exec.approvals.get {} → { path, exists, hash, file: ExecApprovalsFile }
 * PUT → exec.approvals.set { file, baseHash } → updated snapshot
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  return gatewayRequest("exec.approvals.get", {});
});

export const PUT = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as { file: unknown; baseHash?: string };
  return gatewayRequest("exec.approvals.set", {
    file: body.file,
    ...(body.baseHash ? { baseHash: body.baseHash } : {}),
  });
});
