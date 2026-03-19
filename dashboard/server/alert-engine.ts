/**
 * Alert Engine — evaluates alert rules against EventBus events and fires notifications.
 *
 * Subscribes to EventBus events, checks matching alert_rules from SQLite,
 * evaluates cooldown, fires actions (toast/activity/webhook), and creates
 * activity feed entries.
 */

import type { Database } from "@server/db";
import type { EventBus, ServerEvent } from "./event-bus";
import type { DeckRuntime } from "./runtime";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AlertRuleRow = {
  id: string;
  name: string;
  entity_type: string;
  condition: string;
  threshold: number;
  action: string;
  cooldown_ms: number;
  last_fired_at: string | null;
  enabled: number;
};

// Map EventBus event types to alert entity types
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
  // Try common numeric fields
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
function isInCooldown(rule: AlertRuleRow, now: number): boolean {
  if (!rule.last_fired_at) {
    return false;
  }
  const lastFired = new Date(rule.last_fired_at).getTime();
  return now - lastFired < rule.cooldown_ms;
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
// F11: Condition evaluation
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
    // "contains" removed — semantically broken for numeric comparisons (L2 review P1)
    default:
      // Backward compat: unrecognized conditions (e.g. "cost > 100") default to >=
      return value >= threshold;
  }
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

function handleEvent(
  event: ServerEvent,
  db: Database,
  eventBus: EventBus,
  store: DeckRuntime["store"],
): void {
  const entityType = EVENT_TO_ENTITY[event.type];
  if (!entityType) {
    return;
  }

  // Fetch matching enabled rules
  let rules: AlertRuleRow[];
  try {
    rules = db
      .prepare("SELECT * FROM alert_rules WHERE entity_type = ? AND enabled = 1")
      .all(entityType) as AlertRuleRow[];
  } catch {
    return; // Table may not exist yet
  }

  if (rules.length === 0) {
    return;
  }

  const now = Date.now();
  const value = extractEventValue(event.data);

  for (const rule of rules) {
    // F11: Use evaluateCondition instead of hardcoded >= check
    if (!evaluateCondition(value, rule.condition, rule.threshold)) {
      continue;
    }

    // Check cooldown
    if (isInCooldown(rule, now)) {
      continue;
    }

    // --- Rule triggered ---
    const severity = determineSeverity(rule.entity_type, value, rule.threshold);
    const firedPayload = {
      id: `af-${now}-${Math.random().toString(36).slice(2, 8)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      entityType: rule.entity_type,
      condition: rule.condition,
      threshold: rule.threshold,
      actualValue: value,
      severity,
      timestamp: now,
    };

    // Update last_fired_at
    try {
      db.prepare(
        "UPDATE alert_rules SET last_fired_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
      ).run(rule.id);
    } catch {
      // Non-critical
    }

    // Fire action based on rule.action
    switch (rule.action) {
      case "toast":
        eventBus.broadcast("notification.toast", {
          title: rule.name,
          message: `${rule.entity_type}: ${value} ${rule.condition} ${rule.threshold}`,
          severity,
        });
        break;
      case "webhook":
        // Fire webhooks matching "alert.fired" event
        void fireAlertWebhook(db, firedPayload);
        break;
      case "activity":
        // Activity event is always created below
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

    try {
      store.appendEvent("activity.event", activityPayload);
    } catch {
      // Non-critical
    }
    eventBus.broadcast("activity.event", activityPayload);

    // Broadcast alert.fired
    eventBus.broadcast("alert.fired", firedPayload);
  }
}

/** Fire webhook delivery for an alert event. */
async function fireAlertWebhook(db: Database, payload: Record<string, unknown>): Promise<void> {
  try {
    // Dynamic import to avoid circular dependency
    const { fireWebhooks } = await import("../src/lib/webhooks");
    await fireWebhooks(db, "alert.fired", payload);
  } catch {
    console.error("[AlertEngine] webhook delivery failed");
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export function initAlertEngine(runtime: DeckRuntime): () => void {
  const { db, eventBus, store } = runtime;

  const subscriber = (event: ServerEvent) => {
    try {
      handleEvent(event, db, eventBus, store);
    } catch (err) {
      console.error("[AlertEngine] error processing event:", err);
    }
  };

  eventBus.subscribe(subscriber);

  // F12: Return cleanup function for HMR safety
  return () => {
    eventBus.unsubscribe(subscriber);
  };
}
