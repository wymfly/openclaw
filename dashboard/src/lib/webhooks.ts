/**
 * Webhook delivery engine — HMAC-SHA256 signing + exponential backoff retry.
 *
 * Transplanted from Mission Control, adapted for openclaw-deck:
 * - Single-instance (no workspace_id)
 * - Header: X-Signature-256 (per OpenSpec)
 * - User-Agent: OpenClaw-Deck-Webhook/1.0
 * - Backoff: 1s/2s/4s/8s/16s (per OpenSpec)
 * - DB passed as parameter (no lazy import)
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Database } from "@server/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string; // JSON array
  enabled: number;
  consecutive_failures: number;
}

export interface DeliverOpts {
  attempt?: number;
  parentDeliveryId?: string | null;
  allowRetry?: boolean;
}

export interface DeliveryResult {
  success: boolean;
  statusCode: number | null;
  responseBody: string | null;
  error: string | null;
  durationMs: number;
  deliveryId?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Backoff schedule in seconds: 1s, 2s, 4s, 8s, 16s
const BACKOFF_SECONDS = [1, 2, 4, 8, 16];

const MAX_RETRIES = 5;
const DELIVERY_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BODY_LENGTH = 1000;
const DELIVERY_PRUNE_KEEP = 200;

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Compute the next retry delay in seconds, with ±20% jitter.
 */
export function nextRetryDelay(attempt: number): number {
  const base = BACKOFF_SECONDS[Math.min(attempt, BACKOFF_SECONDS.length - 1)];
  const jitter = base * 0.2 * (2 * Math.random() - 1); // ±20%
  return Math.round(base + jitter);
}

/**
 * Verify a webhook signature using constant-time comparison.
 * Consumers can use this to validate incoming webhook deliveries.
 */
export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string | null | undefined,
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;

  // Constant-time comparison
  const sigBuf = Buffer.from(signatureHeader);
  const expectedBuf = Buffer.from(expected);

  if (sigBuf.length !== expectedBuf.length) {
    // Compare expected against a dummy buffer of matching length to avoid timing leak
    const dummy = Buffer.alloc(expectedBuf.length);
    timingSafeEqual(expectedBuf, dummy);
    return false;
  }

  return timingSafeEqual(sigBuf, expectedBuf);
}

/**
 * Sign a payload body with the given secret.
 * Returns the full `sha256=<hex>` string for the X-Signature-256 header.
 */
export function signPayload(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

/**
 * Deliver a webhook event to the configured URL.
 * Logs the delivery to the webhook_deliveries table and handles
 * retry scheduling + circuit breaker logic.
 */
export async function deliverWebhook(
  db: Database,
  webhook: Webhook,
  eventType: string,
  payload: Record<string, unknown>,
  opts: DeliverOpts = {},
): Promise<DeliveryResult> {
  const { attempt = 0, parentDeliveryId = null, allowRetry = true } = opts;

  const body = JSON.stringify({
    event: eventType,
    timestamp: Math.floor(Date.now() / 1000),
    data: payload,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "OpenClaw-Deck-Webhook/1.0",
    "X-Deck-Event": eventType,
  };

  // HMAC signature if secret is configured
  if (webhook.secret) {
    headers["X-Signature-256"] = signPayload(webhook.secret, body);
  }

  const start = Date.now();
  let statusCode: number | null = null;
  let responseBody: string | null = null;
  let error: string | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    const res = await fetch(webhook.url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    statusCode = res.status;
    responseBody = await res.text().catch(() => null);
    if (responseBody && responseBody.length > MAX_RESPONSE_BODY_LENGTH) {
      responseBody = responseBody.slice(0, MAX_RESPONSE_BODY_LENGTH) + "...";
    }
  } catch (err: unknown) {
    const e = err as Error;
    error = e.name === "AbortError" ? "Timeout (10s)" : e.message;
  }

  const durationMs = Date.now() - start;
  const success = statusCode !== null && statusCode >= 200 && statusCode < 300;
  const deliveryId = `wd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Log delivery attempt and handle retry/circuit-breaker logic
  try {
    db.prepare(`
      INSERT INTO webhook_deliveries (id, webhook_id, event_type, payload, status_code, response_body, error, duration_ms, attempt, is_retry, parent_delivery_id, success)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      deliveryId,
      webhook.id,
      eventType,
      body,
      statusCode,
      responseBody,
      error,
      durationMs,
      attempt,
      attempt > 0 ? 1 : 0,
      parentDeliveryId,
      success ? 1 : 0,
    );

    // Update webhook last_fired
    db.prepare(`
      UPDATE webhooks SET last_fired_at = datetime('now'), last_status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(statusCode ?? -1, webhook.id);

    // Circuit breaker + retry scheduling (skip for test deliveries)
    if (allowRetry) {
      if (success) {
        // Reset consecutive failures on success
        db.prepare("UPDATE webhooks SET consecutive_failures = 0 WHERE id = ?").run(webhook.id);
      } else {
        // Increment consecutive failures
        db.prepare(
          "UPDATE webhooks SET consecutive_failures = consecutive_failures + 1 WHERE id = ?",
        ).run(webhook.id);

        if (attempt < MAX_RETRIES - 1) {
          // Schedule retry
          const delaySec = nextRetryDelay(attempt);
          const nextRetryAt = Math.floor(Date.now() / 1000) + delaySec;
          db.prepare("UPDATE webhook_deliveries SET next_retry_at = ? WHERE id = ?").run(
            nextRetryAt,
            deliveryId,
          );
        } else {
          // Exhausted retries — trip circuit breaker
          const wh = db
            .prepare("SELECT consecutive_failures FROM webhooks WHERE id = ?")
            .get(webhook.id) as { consecutive_failures: number } | undefined;
          if (wh && wh.consecutive_failures >= MAX_RETRIES) {
            db.prepare(
              "UPDATE webhooks SET enabled = 0, updated_at = datetime('now') WHERE id = ?",
            ).run(webhook.id);
            console.warn(
              `[Webhook] Circuit breaker tripped — disabled webhook ${webhook.id} (${webhook.name}) after exhausting retries`,
            );
          }
        }
      }
    }

    // Prune old deliveries (keep last N per webhook)
    db.prepare(`
      DELETE FROM webhook_deliveries
      WHERE webhook_id = ? AND id NOT IN (
        SELECT id FROM webhook_deliveries WHERE webhook_id = ? ORDER BY created_at DESC LIMIT ?
      )
    `).run(webhook.id, webhook.id, DELIVERY_PRUNE_KEEP);
  } catch (logErr) {
    console.error("[Webhook] delivery logging/pruning failed:", logErr);
  }

  return {
    success,
    statusCode,
    responseBody,
    error,
    durationMs,
    deliveryId,
  };
}

// ---------------------------------------------------------------------------
// Retry processor
// ---------------------------------------------------------------------------

/**
 * Process pending webhook retries. Called by the scheduler.
 * Picks up deliveries where next_retry_at has passed and re-delivers them.
 */
export async function processWebhookRetries(
  db: Database,
): Promise<{ ok: boolean; message: string }> {
  try {
    const now = Math.floor(Date.now() / 1000);

    // Find deliveries ready for retry (limit batch to 50)
    const pendingRetries = db
      .prepare(
        `
      SELECT wd.id, wd.webhook_id, wd.event_type, wd.payload, wd.attempt,
             w.id as w_id, w.name as w_name, w.url as w_url, w.secret as w_secret,
             w.events as w_events, w.enabled as w_enabled, w.consecutive_failures as w_consecutive_failures
      FROM webhook_deliveries wd
      JOIN webhooks w ON w.id = wd.webhook_id AND w.enabled = 1
      WHERE wd.next_retry_at IS NOT NULL AND wd.next_retry_at <= ?
      LIMIT 50
    `,
      )
      .all(now) as Array<{
      id: string;
      webhook_id: string;
      event_type: string;
      payload: string;
      attempt: number;
      w_id: string;
      w_name: string;
      w_url: string;
      w_secret: string | null;
      w_events: string;
      w_enabled: number;
      w_consecutive_failures: number;
    }>;

    if (pendingRetries.length === 0) {
      return { ok: true, message: "No pending retries" };
    }

    // Clear next_retry_at immediately to prevent double-processing
    const clearStmt = db.prepare("UPDATE webhook_deliveries SET next_retry_at = NULL WHERE id = ?");
    for (const row of pendingRetries) {
      clearStmt.run(row.id);
    }

    // Re-deliver each
    let succeeded = 0;
    let failed = 0;
    for (const row of pendingRetries) {
      const webhook: Webhook = {
        id: row.w_id,
        name: row.w_name,
        url: row.w_url,
        secret: row.w_secret,
        events: row.w_events,
        enabled: row.w_enabled,
        consecutive_failures: row.w_consecutive_failures,
      };

      // Parse the original payload from the stored JSON body
      let parsedPayload: Record<string, unknown>;
      try {
        const parsed = JSON.parse(row.payload) as Record<string, unknown>;
        parsedPayload = (parsed.data as Record<string, unknown>) ?? parsed;
      } catch {
        parsedPayload = {};
      }

      const result = await deliverWebhook(db, webhook, row.event_type, parsedPayload, {
        attempt: row.attempt + 1,
        parentDeliveryId: row.id,
        allowRetry: true,
      });

      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    return {
      ok: true,
      message: `Processed ${pendingRetries.length} retries (${succeeded} ok, ${failed} failed)`,
    };
  } catch (err: unknown) {
    const e = err as Error;
    return { ok: false, message: `Webhook retry failed: ${e.message}` };
  }
}

// ---------------------------------------------------------------------------
// Event matching
// ---------------------------------------------------------------------------

/**
 * Fire all matching webhooks for an event type.
 * Queries enabled webhooks whose `events` JSON array includes the event type or '*'.
 */
export async function fireWebhooks(
  db: Database,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  let webhooks: Webhook[];
  try {
    webhooks = db.prepare("SELECT * FROM webhooks WHERE enabled = 1").all() as Webhook[];
  } catch {
    return; // DB not ready or table doesn't exist yet
  }

  if (webhooks.length === 0) {
    return;
  }

  const matchingWebhooks = webhooks.filter((wh) => {
    try {
      const events: string[] = JSON.parse(wh.events);
      return events.includes("*") || events.includes(eventType);
    } catch {
      return false;
    }
  });

  await Promise.allSettled(
    matchingWebhooks.map((wh) => deliverWebhook(db, wh, eventType, payload, { allowRetry: true })),
  );
}
