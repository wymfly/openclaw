/**
 * POST /api/skills/update-clawhub — Update ClawHub skill(s).
 *
 * Gateway contract: skills.update { source: "clawhub", slug?, all? }
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import type { GatewayMethodMap } from "@/types/gateway-protocol.generated";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    slug?: string;
    all?: boolean;
  };
  return gwRequest("skills.update", {
    source: "clawhub",
    ...(body.slug ? { slug: body.slug } : {}),
    ...(body.all ? { all: true } : {}),
  } as GatewayMethodMap["skills.update"]["params"]);
});
