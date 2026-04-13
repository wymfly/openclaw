/**
 * GET /api/commands — Full command catalog with typed argument schemas.
 *
 * Gateway: commands.list → { commands[{ name, source, category, scope, args }] }
 *
 * Complements deck.commands.discover (lightweight) with richer arg schemas,
 * scopes, and text aliases for enhanced command palette UX.
 */
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  return gwRequest("commands.list", {});
});
