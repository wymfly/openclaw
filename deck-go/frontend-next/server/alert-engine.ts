/**
 * Alert Engine — evaluates alert rules against EventBus events and fires notifications.
 *
 * Subscribes to EventBus events, checks matching alert rules from JSON store,
 * evaluates cooldown, fires actions (toast/activity/webhook), and creates
 * activity feed entries.
 */

import { getAlertRuleStore, type AlertRule } from "./budget-alert-stores";
import type { EventBus, ServerEvent } from "./event-bus";
import type { DeckRuntime } from "./runtime";

// ---------------------------------------------------------------------------
// Map EventBus event types to alert entity types
// ---------------------------------------------------------------------------

const EVENT_TO_ENTITY: Record<string, string> = {
  "budget.warn": "usage",
  "budget.over": "usage",
  "cron.run.complete": "cron",
  "approval.pending": "approval",
  "approval.resolved": "approval",
  "agent.updated": "agent",
  agent: "agent",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract a numeric value from event data for threshold comparison. */
function extractEventValue(data: unknown): number {
  if (data == null) {
    return 0;
  }
  const d = data as Record<string, unknown>;
  if (typeof d.value === "number") {
    return d.value;
  }
  if (typeof d.count === "number") {
    return d.count;
  }
  if (typeof d.current === "number") {
    return d.current;
  }
  if (typeof d.percentage === "number") {
    return d.percentage;
  }
  if (typeof d.total === "number") {
    return d.total;
  }
  if (typeof d.cost === "number") {
    return d.cost;
  }
  return 0;
}

/** Check if a rule is in cooldown. */
function isInCooldown(rule: AlertRule, now: number): boolean {
  if (!rule.lastFiredAt) {
    return false;
  }
  const lastFired = new Date(rule.lastFiredAt).getTime();
  return now - lastFired < rule.cooldownMs;
}

/** Determine severity based on entity type and threshold proximity. */
function determineSeverity(
  entityType: string,
  value: number,
  threshold: number,
): "info" | "warning" | "critical" {
  const ratio = threshold > 0 ? value / threshold : 1;
  if (entityType === "usage" && ratio >= 1.5) {
    return "critical";
  }
  if (ratio >= 2) {
    return "critical";
  }
  if (ratio >= 1) {
    return "warning";
  }
  return "info";
}

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------

/** Evaluate a condition operator against value and threshold. */
function evaluateCondition(value: number, condition: string, threshold: number): boolean {
  switch (condition) {
    case ">":
      return value > threshold;
    case ">=":
      return value >= threshold;
    case "<":
      return value < threshold;
    case "<=":
      return value <= threshold;
    case "==":
      return value === threshold;
    case "!=":
      return value !== threshold;
    default:
      return value >= threshold;
  }
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

function handleEvent(event: ServerEvent, eventBus: EventBus): void {
  const entityType = EVENT_TO_ENTITY[event.type];
  if (!entityType) {
    return;
  }

  const store = getAlertRuleStore();
  const rules = store.get().filter((r) => r.entityType === entityType && r.enabled);

  if (rules.length === 0) {
    return;
  }

  const now = Date.now();
  const value = extractEventValue(event.data);

  for (const rule of rules) {
    if (!evaluateCondition(value, rule.condition, rule.threshold)) {
      continue;
    }

    if (isInCooldown(rule, now)) {
      continue;
    }

    // --- Rule triggered ---
    const severity = determineSeverity(rule.entityType, value, rule.threshold);
    const firedPayload = {
      id: `af-${now}-${Math.random().toString(36).slice(2, 8)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      entityType: rule.entityType,
      condition: rule.condition,
      threshold: rule.threshold,
      actualValue: value,
      severity,
      timestamp: now,
    };

    // Update lastFiredAt
    store.updateItem(
      (r) => r.id === rule.id,
      (r) => ({ ...r, lastFiredAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
    );

    // Fire action based on rule.action
    switch (rule.action) {
      case "toast":
        eventBus.broadcast("notification.toast", {
          title: rule.name,
          message: `${rule.entityType}: ${value} ${rule.condition} ${rule.threshold}`,
          severity,
        });
        break;
      case "webhook":
        void fireAlertWebhook(firedPayload);
        break;
      case "activity":
        break;
    }

    // Always create activity feed entry
    const activityPayload = {
      id: `act-${now}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: now,
      type: "alert",
      description: `Alert "${rule.name}" fired: ${rule.condition} = ${value} (threshold: ${rule.threshold})`,
      details: JSON.stringify(firedPayload),
    };

    eventBus.broadcast("activity.event", activityPayload);
    eventBus.broadcast("alert.fired", firedPayload);
  }
}

/** Fire webhook delivery for an alert event. */
async function fireAlertWebhook(payload: Record<string, unknown>): Promise<void> {
  try {
    const { fireWebhooks } = await import("../src/lib/webhooks");
    await fireWebhooks("alert.fired", payload);
  } catch {
    console.error("[AlertEngine] webhook delivery failed");
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export function initAlertEngine(runtime: DeckRuntime): () => void {
  const { eventBus } = runtime;

  const subscriber = (event: ServerEvent) => {
    try {
      handleEvent(event, eventBus);
    } catch (err) {
      console.error("[AlertEngine] error processing event:", err);
    }
  };

  eventBus.subscribe(subscriber);

  return () => {
    eventBus.unsubscribe(subscriber);
  };
}
