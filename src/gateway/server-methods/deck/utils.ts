import { createHash } from "node:crypto";
import { type ErrorCode, ErrorCodes } from "../../protocol/schema/error-codes.js";

/** Normalize a binding match for deterministic hashing. */
export function normalizeBindingMatchForHash(
  match: Record<string, unknown>,
): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(match).toSorted()) {
    const val = match[key];
    if (val === undefined || val === null) {
      continue;
    }
    if (typeof val === "string") {
      sorted[key] = val.trim().toLowerCase();
    } else if (typeof val === "object" && !Array.isArray(val)) {
      sorted[key] = normalizeBindingMatchForHash(val as Record<string, unknown>);
    } else if (Array.isArray(val)) {
      sorted[key] = val
        .map((v) => (typeof v === "string" ? v.trim().toLowerCase() : v))
        .toSorted((a, b) => String(a).localeCompare(String(b)));
    } else {
      sorted[key] = val;
    }
  }
  return sorted;
}

/** Generate a deterministic content-hash ID for a binding match. */
export function computeBindingId(match: Record<string, unknown>): string {
  const normalized = normalizeBindingMatchForHash(match);
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex").slice(0, 12);
}

/** Validate baseHash against current config hash. Returns error shape or null. */
export function validateBaseHash(
  baseHash: string | undefined,
  currentHash: string,
): { code: ErrorCode; message: string } | null {
  if (!baseHash || typeof baseHash !== "string") {
    return {
      code: ErrorCodes.INVALID_REQUEST,
      message: "baseHash is required for write operations",
    };
  }
  if (baseHash !== currentHash) {
    return {
      code: ErrorCodes.INVALID_REQUEST,
      message: "config has changed since last read (baseHash mismatch)",
    };
  }
  return null;
}
