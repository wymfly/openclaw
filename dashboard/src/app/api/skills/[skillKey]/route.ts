/**
 * PATCH /api/skills/[skillKey] — Update a skill's configuration.
 *
 * Gateway contract: skills.update { skillKey, enabled?, apiKey?, env? }
 * Note: empty apiKey/env values delete the field.
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ skillKey: string }> };

export const PATCH = withAuth(async (request: NextRequest, ctx: unknown) => {
  const { skillKey } = await (ctx as RouteContext).params;
  const body = await request.json();
  return gatewayRequest("skills.update", { skillKey, ...body });
});
