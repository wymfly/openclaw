/**
 * Webhook delivery engine — HMAC-SHA256 signing + exponential backoff retry.
 *
 * Uses JSON file storage via JsonStore for webhook configs and delivery logs.
 * - Header: X-Signature-256 (per OpenSpec)
 * - User-Agent: OpenClaw-Deck-Webhook/1.0
 * - Backoff: 1s/2s/4s/8s/16s (per OpenSpec)
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { getJsonStore } from "./json-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  enabled: boolean;
  consecutiveFailures: number;
  lastFiredAt: string | null;
  lastStatus: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: string;
  payload: string;
  statusCode: number | null;
  responseBody: string | null;
  error: string | null;
  durationMs: number;
  attempt: number;
  isRetry: boolean;
  parentDeliveryId: string | null;
  success: boolean;
  nextRetryAt: number | null;
  createdAt: string;
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
const MAX_DELIVERIES = 500;

// ---------------------------------------------------------------------------
// Store accessors
// ---------------------------------------------------------------------------

export function getWebhookStore() {
  return getJsonStore<Webhook[]>("webhooks", []);
}

export function getDeliveryStore() {
  return getJsonStore<WebhookDelivery[]>("webhook-deliveries", []);
}

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
 * Logs the delivery to the deliveries store and handles
 * retry scheduling + circuit breaker logic.
 */
export async function deliverWebhook(
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
  const now = new Date().toISOString();

  // Log delivery attempt
  try {
    const delivery: WebhookDelivery = {
      id: deliveryId,
      webhookId: webhook.id,
      eventType,
      payload: body,
      statusCode,
      responseBody,
      error,
      durationMs,
      attempt,
      isRetry: attempt > 0,
      parentDeliveryId,
      success,
      nextRetryAt: null,
      createdAt: now,
    };

    const deliveryStore = getDeliveryStore();
    deliveryStore.append(delivery);

    // Update webhook last_fired
    const webhookStore = getWebhookStore();
    webhookStore.updateItem(
      (w) => w.id === webhook.id,
      (w) => ({ ...w, lastFiredAt: now, lastStatus: statusCode ?? -1, updatedAt: now }),
    );

    // Circuit breaker + retry scheduling (skip for test deliveries)
    if (allowRetry) {
      if (success) {
        webhookStore.updateItem(
          (w) => w.id === webhook.id,
          (w) => ({ ...w, consecutiveFailures: 0 }),
        );
      } else {
        webhookStore.updateItem(
          (w) => w.id === webhook.id,
          (w) => ({ ...w, consecutiveFailures: w.consecutiveFailures + 1 }),
        );

        if (attempt < MAX_RETRIES - 1) {
          // Schedule retry
          const delaySec = nextRetryDelay(attempt);
          const nextRetryAt = Math.floor(Date.now() / 1000) + delaySec;
          deliveryStore.updateItem(
            (d) => d.id === deliveryId,
            (d) => ({ ...d, nextRetryAt }),
          );
        } else {
          // Exhausted retries — trip circuit breaker
          const wh = webhookStore.find((w) => w.id === webhook.id);
          if (wh && wh.consecutiveFailures >= MAX_RETRIES) {
            webhookStore.updateItem(
              (w) => w.id === webhook.id,
              (w) => ({ ...w, enabled: false, updatedAt: new Date().toISOString() }),
            );
            console.warn(
              `[Webhook] Circuit breaker tripped — disabled webhook ${webhook.id} (${webhook.name}) after exhausting retries`,
            );
          }
        }
      }
    }

    // Truncate deliveries to keep last MAX_DELIVERIES
    deliveryStore.truncate(MAX_DELIVERIES);
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
 * Picks up deliveries where nextRetryAt has passed and re-delivers them.
 */
export async function processWebhookRetries(): Promise<{ ok: boolean; message: string }> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const deliveryStore = getDeliveryStore();
    const webhookStore = getWebhookStore();

    // Find deliveries ready for retry
    const allDeliveries = deliveryStore.get();
    const pendingRetries = allDeliveries
      .filter((d) => d.nextRetryAt !== null && d.nextRetryAt <= now)
      .slice(0, 50);

    if (pendingRetries.length === 0) {
      return { ok: true, message: "No pending retries" };
    }

    // Clear nextRetryAt to prevent double-processing
    const retryIds = new Set(pendingRetries.map((d) => d.id));
    deliveryStore.update((all) =>
      all.map((d) => (retryIds.has(d.id) ? { ...d, nextRetryAt: null } : d)),
    );

    // Re-deliver each
    let succeeded = 0;
    let failed = 0;
    for (const row of pendingRetries) {
      const webhook = webhookStore.find((w) => w.id === row.webhookId && w.enabled);
      if (!webhook) {
        continue;
      }

      // Parse the original payload from the stored JSON body
      let parsedPayload: Record<string, unknown>;
      try {
        const parsed = JSON.parse(row.payload) as Record<string, unknown>;
        parsedPayload = (parsed.data as Record<string, unknown>) ?? parsed;
      } catch {
        parsedPayload = {};
      }

      const result = await deliverWebhook(webhook, row.eventType, parsedPayload, {
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
 * Queries enabled webhooks whose events array includes the event type or '*'.
 */
export async function fireWebhooks(
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const webhookStore = getWebhookStore();
  const webhooks = webhookStore.get();

  const matchingWebhooks = webhooks.filter(
    (wh) => wh.enabled && (wh.events.includes("*") || wh.events.includes(eventType)),
  );

  if (matchingWebhooks.length === 0) {
    return;
  }

  await Promise.allSettled(
    matchingWebhooks.map((wh) => deliverWebhook(wh, eventType, payload, { allowRetry: true })),
  );
}
