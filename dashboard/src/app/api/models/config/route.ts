/**
 * /api/models/config — Global provider configuration.
 *
 * GET   — Read global provider config from openclaw.json
 * PATCH — Update global provider config
 *
 * Gateway contracts:
 *   config.get:   {} (no params, returns { raw, hash })
 *   config.patch: { raw, baseHash?, sessionKey?, note?, restartDelayMs? }
 *
 * The Gateway returns raw config as YAML. We normalize it to JSON
 * for the client store (which uses JSON.parse). This route only edits
 * the global config layer, not agent-local runtime inventory.
 */
import { type NextRequest } from "next/server";
import YAML from "yaml";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

/**
 * Try to parse raw config string (YAML or JSON) into an object,
 * then re-serialize as JSON so the client can use JSON.parse.
 */
function normalizeRawToJson(raw: string): string {
  // Already valid JSON? Return as-is.
  try {
    JSON.parse(raw);
    return raw;
  } catch {
    // Not JSON — try YAML
  }
  try {
    const obj = YAML.parse(raw);
    return JSON.stringify(obj);
  } catch {
    // Unparseable — return as-is, client will handle gracefully
    return raw;
  }
}

export const GET = withAuth(async (_request: NextRequest) => {
  const res = await gwRequest("config.get", {});
  if (!res.ok) {
    return res;
  }
  const data = await res.json();
  if (typeof data.raw === "string") {
    data.raw = normalizeRawToJson(data.raw);
  }
  return Response.json(data);
});

export const PATCH = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    raw?: string;
    baseHash?: string;
    note?: string;
  };

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!body.raw) {
    return Response.json({ error: "raw config content is required" }, { status: 400 });
  }

  // Client sends JSON raw config — pass through as-is.
  // Gateway config.patch accepts JSON/JSON5/YAML; JSON is safest.
  return gwRequest("config.patch", {
    raw: body.raw,
    ...(body.baseHash ? { baseHash: body.baseHash } : {}),
    ...(body.note ? { note: body.note } : {}),
  });
});
