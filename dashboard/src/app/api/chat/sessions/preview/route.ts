/**
 * /api/chat/sessions/preview — Lightweight session previews for sidebar.
 *
 * POST — Fetch preview summaries for a batch of session keys.
 *
 * Gateway contract:
 *   sessions.preview: { keys: string[] } → { ts, previews: [{ key, status, items }] }
 *
 * This is a lighter alternative to sessions.list for refreshing sidebar previews
 * without re-fetching full session metadata. See transcript-history.ts for the
 * full transcript seam (chat.history) — do not conflate the two.
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as { keys?: string[] };

  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    return Response.json({ error: "keys[] is required" }, { status: 400 });
  }

  return gwRequest("sessions.preview", { keys: body.keys });
});
