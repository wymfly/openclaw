/**
 * POST /api/skills/install — Install a skill.
 *
 * Gateway contract: skills.install { name, installId, timeoutMs? } for install options,
 * or { source: "clawhub", slug } for ClawHub installs.
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as
    | { name: string; installId: string; timeoutMs?: number }
    | { source: "clawhub"; slug: string };
  return gwRequest("skills.install", body);
});
