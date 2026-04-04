/**
 * POST /api/skills/install — Install a skill.
 *
 * Gateway contract: skills.install { name, installId, timeoutMs? } for install options,
 * or { source: "clawhub", slug } for ClawHub installs.
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import type { SkillsInstallParams } from "@/types/gateway-protocol.generated";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as SkillsInstallParams;
  return gwRequest("skills.install", body);
});
