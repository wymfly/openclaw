import { validateRequest, type AccessGateDb } from "@server/access-gate";
import { getRuntime } from "@server/runtime";
/**
 * withAuth — higher-order function that wraps API route handlers with
 * authentication (access-gate) and rate-limiting checks.
 *
 * Usage:
 *   export const GET = withAuth(async (req) => { ... });
 *   export const POST = withAuth(async (req) => { ... });
 *
 * Because Next.js middleware runs in the Edge Runtime (which cannot
 * import native Node modules like better-sqlite3), we perform auth
 * checks inside each route handler instead.
 */
import { NextRequest, NextResponse } from "next/server";

type ErrorBody = { error: string };

/**
 * Extract the client IP from the request.
 * Prefers `x-forwarded-for` (first entry), falls back to `"unknown"`.
 */
function extractIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return "unknown";
}

/**
 * Convert request headers to a plain record for the access gate.
 */
function headersToRecord(req: NextRequest): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  out["authorization"] = req.headers.get("authorization") ?? undefined;
  out["x-deck-token"] = req.headers.get("x-deck-token") ?? undefined;
  return out;
}

// biome-ignore lint: using Function type for route handler flexibility
type RouteHandler = (req: NextRequest, ...args: unknown[]) => Promise<Response> | Response;

/**
 * Wrap an API route handler with authentication + rate-limit checks.
 */
export function withAuth(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ...args: unknown[]) => {
    const runtime = getRuntime();

    // 1. Authentication check
    const db = runtime?.db as unknown as AccessGateDb | undefined;
    const authResult = validateRequest(headersToRecord(req), db);
    if (!authResult.valid) {
      return NextResponse.json({ error: authResult.error ?? "Unauthorized" } satisfies ErrorBody, {
        status: 401,
      });
    }

    // 2. Rate-limit check
    if (runtime?.rateLimiter) {
      const ip = extractIp(req);
      const rl = runtime.rateLimiter.checkLimit(ip);
      if (!rl.allowed) {
        return NextResponse.json({ error: "Too many requests" } satisfies ErrorBody, {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(rl.resetAt),
          },
        });
      }
    }

    return handler(req, ...args);
  };
}
