// Shared utility functions for WeCom capability API clients.
// Extracted to avoid duplication across approval/contact/external-contact/meeting/todo clients.

/** WeCom business error (errcode != 0). Not retryable — the API rejected the request itself. */
export class WecomBusinessError extends Error {
  constructor(
    public readonly errcode: number,
    message: string,
  ) {
    super(message);
    this.name = "WecomBusinessError";
  }
}

export function readString(value: unknown): string {
  const trimmed = String(value ?? "").trim();
  return trimmed || "";
}

export function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => readString(item)).filter(Boolean) : [];
}

export function withoutErrFields<T extends Record<string, unknown>>(
  value: T,
): Omit<T, "errcode" | "errmsg"> {
  const cloned = { ...value };
  delete (cloned as { errcode?: unknown }).errcode;
  delete (cloned as { errmsg?: unknown }).errmsg;
  return cloned;
}

export async function parseJsonResponse(
  res: Response,
  actionLabel: string,
): Promise<Record<string, unknown>> {
  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    if (!res.ok) {
      throw new Error(`WeCom ${actionLabel} failed: HTTP ${res.status}`);
    }
    throw new Error(`WeCom ${actionLabel} failed: invalid JSON response`);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`WeCom ${actionLabel} failed: empty response`);
  }

  if (!res.ok) {
    throw new Error(`WeCom ${actionLabel} failed: HTTP ${res.status} ${JSON.stringify(payload)}`);
  }

  const errcode = Number(payload.errcode ?? 0);
  if (errcode !== 0) {
    throw new WecomBusinessError(
      errcode,
      `WeCom ${actionLabel} failed: ${String(payload.errmsg || "unknown error")} (errcode ${String(payload.errcode)})`,
    );
  }

  return payload;
}

/** Returns true if the error is a network/transient error worth retrying. */
export function isRetryableError(err: unknown): boolean {
  if (err instanceof WecomBusinessError) return false;
  return true;
}
