/**
 * Budget Rules + Alert Rules — JSON file persistence.
 *
 * Replaces SQLite budget_rules and alert_rules tables.
 */
import { getJsonStore, type JsonStore } from "../src/lib/json-store";

// ---------------------------------------------------------------------------
// Budget Rule
// ---------------------------------------------------------------------------

export interface BudgetRule {
  id: string;
  name: string;
  scope: string;
  agentId: string | null;
  taskId: string | null;
  dimension: string;
  warnThreshold: number | null;
  overThreshold: number | null;
  period: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export function getBudgetRuleStore(): JsonStore<BudgetRule[]> {
  return getJsonStore<BudgetRule[]>("budget-rules", []);
}

// ---------------------------------------------------------------------------
// Alert Rule
// ---------------------------------------------------------------------------

export interface AlertRule {
  id: string;
  name: string;
  entityType: string;
  condition: string;
  threshold: number;
  action: string;
  cooldownMs: number;
  lastFiredAt: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export function getAlertRuleStore(): JsonStore<AlertRule[]> {
  return getJsonStore<AlertRule[]>("alert-rules", []);
}
