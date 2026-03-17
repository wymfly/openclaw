/**
 * Budget Governance — multi-dimension threshold evaluation.
 *
 * Transplanted from openclaw-control-center, adapted for openclaw-deck:
 * - Local type definitions (no external types import)
 * - Inlined DEFAULT_BUDGET_POLICY
 * - Pure functional — no side effects, no vendor dependencies
 *
 * Evaluates token/cost usage against configurable thresholds per scope
 * (agent, project, task) and returns ok/warn/over status for each metric.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BudgetDimension = "tokensIn" | "tokensOut" | "totalTokens" | "cost";
export type BudgetStatus = "ok" | "warn" | "over";
export type BudgetScope = "agent" | "project" | "task";

export interface BudgetThresholds {
  tokensIn?: number;
  tokensOut?: number;
  totalTokens?: number;
  cost?: number;
  warnRatio?: number;
}

export interface BudgetUsageSnapshot {
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  cost: number;
}

export interface BudgetMetricEvaluation {
  metric: BudgetDimension;
  used: number;
  limit: number;
  warnAt: number;
  status: BudgetStatus;
}

export interface BudgetEvaluation {
  scope: BudgetScope;
  scopeId: string;
  label: string;
  thresholds: BudgetThresholds;
  usage: BudgetUsageSnapshot;
  metrics: BudgetMetricEvaluation[];
  status: BudgetStatus;
}

export interface BudgetSummary {
  total: number;
  ok: number;
  warn: number;
  over: number;
  evaluations: BudgetEvaluation[];
}

export interface BudgetPolicyConfig {
  defaults: BudgetThresholds;
  agent: Record<string, BudgetThresholds>;
  project: Record<string, BudgetThresholds>;
  task: Record<string, BudgetThresholds>;
}

/** Local BudgetRule type aligned with the budget_rules SQLite table. */
export interface BudgetRule {
  id: string;
  name: string;
  scope: string;
  agentId?: string;
  taskId?: string;
  dimension: BudgetDimension;
  warnThreshold?: number;
  overThreshold?: number;
  period: string;
  enabled: number;
}

// ---------------------------------------------------------------------------
// Input types (for computeBudgetSummary)
// ---------------------------------------------------------------------------

export interface SessionSummary {
  sessionKey: string;
  agentId?: string;
}

export interface SessionStatusSnapshot {
  sessionKey: string;
  tokensIn?: number;
  tokensOut?: number;
  cost?: number;
}

export interface AgentBudgetPlan {
  agentId: string;
  label?: string;
  thresholds: BudgetThresholds;
}

export interface ProjectTask {
  taskId: string;
  projectId: string;
  title: string;
  sessionKeys: string[];
  budget: BudgetThresholds;
}

export interface ProjectRecord {
  projectId: string;
  title: string;
  budget: BudgetThresholds;
}

export interface ProjectStoreSnapshot {
  projects: ProjectRecord[];
}

export interface TaskStoreSnapshot {
  tasks: ProjectTask[];
  agentBudgets: AgentBudgetPlan[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_WARN_RATIO = 0.8;

export const DEFAULT_BUDGET_POLICY: BudgetPolicyConfig = {
  defaults: {
    warnRatio: DEFAULT_WARN_RATIO,
  },
  agent: {},
  project: {},
  task: {},
};

// ---------------------------------------------------------------------------
// Core evaluation
// ---------------------------------------------------------------------------

/**
 * Compute a full budget summary across agents, tasks, and projects.
 *
 * Pure function: takes all data as parameters, returns a summary with
 * per-scope evaluations and aggregate ok/warn/over counts.
 */
export function computeBudgetSummary(
  sessions: SessionSummary[],
  statuses: SessionStatusSnapshot[],
  tasks: TaskStoreSnapshot,
  projects: ProjectStoreSnapshot,
  policy: BudgetPolicyConfig = DEFAULT_BUDGET_POLICY,
): BudgetSummary {
  const evaluations: BudgetEvaluation[] = [];
  const statusBySessionKey = buildStatusMap(statuses);
  const agentBySessionKey = buildAgentMap(sessions);
  const projectById = new Map(projects.projects.map((project) => [project.projectId, project]));

  for (const agentBudget of tasks.agentBudgets) {
    const keys: string[] = [];
    for (const [sessionKey, agentId] of agentBySessionKey.entries()) {
      if (agentId === agentBudget.agentId) {
        keys.push(sessionKey);
      }
    }

    evaluations.push(
      evaluateBudget(
        "agent",
        agentBudget.agentId,
        agentBudget.label ?? agentBudget.agentId,
        resolveThresholds("agent", agentBudget.agentId, agentBudget.thresholds, policy),
        aggregateUsage(statusBySessionKey, keys),
      ),
    );
  }

  const projectSessionKeys = new Map<string, Set<string>>();
  for (const task of tasks.tasks) {
    const project = projectById.get(task.projectId);
    const projectTitle = project?.title ?? task.projectId;

    let keySet = projectSessionKeys.get(task.projectId);
    if (!keySet) {
      keySet = new Set<string>();
      projectSessionKeys.set(task.projectId, keySet);
    }
    for (const sessionKey of task.sessionKeys) {
      keySet.add(sessionKey);
    }

    evaluations.push(
      evaluateBudget(
        "task",
        task.taskId,
        `${projectTitle} / ${task.title}`,
        resolveThresholds("task", task.taskId, task.budget, policy),
        aggregateUsage(statusBySessionKey, task.sessionKeys),
      ),
    );
  }

  for (const project of projects.projects) {
    evaluations.push(
      evaluateBudget(
        "project",
        project.projectId,
        project.title,
        resolveThresholds("project", project.projectId, project.budget, policy),
        aggregateUsage(statusBySessionKey, [
          ...(projectSessionKeys.get(project.projectId) ?? new Set<string>()),
        ]),
      ),
    );
  }

  return {
    total: evaluations.length,
    ok: evaluations.filter((item) => item.status === "ok").length,
    warn: evaluations.filter((item) => item.status === "warn").length,
    over: evaluations.filter((item) => item.status === "over").length,
    evaluations,
  };
}

// ---------------------------------------------------------------------------
// Simple rule-based evaluation (for SQLite budget_rules)
// ---------------------------------------------------------------------------

/**
 * Evaluate a single budget rule against a current value.
 * Returns the status (ok/warn/over) based on thresholds.
 */
export function evaluateBudgetRule(
  rule: BudgetRule,
  currentValue: number,
): { status: BudgetStatus; current: number; warnThreshold?: number; overThreshold?: number } {
  let status: BudgetStatus = "ok";

  if (rule.overThreshold !== undefined && currentValue > rule.overThreshold) {
    status = "over";
  } else if (rule.warnThreshold !== undefined && currentValue >= rule.warnThreshold) {
    status = "warn";
  }

  return {
    status,
    current: currentValue,
    warnThreshold: rule.warnThreshold,
    overThreshold: rule.overThreshold,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildStatusMap(statuses: SessionStatusSnapshot[]): Map<string, SessionStatusSnapshot> {
  const map = new Map<string, SessionStatusSnapshot>();
  for (const status of statuses) {
    map.set(status.sessionKey, status);
  }
  return map;
}

function buildAgentMap(sessions: SessionSummary[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const session of sessions) {
    if (!session.agentId) {
      continue;
    }
    map.set(session.sessionKey, session.agentId);
  }
  return map;
}

function aggregateUsage(
  statusBySessionKey: Map<string, SessionStatusSnapshot>,
  sessionKeys: string[],
): BudgetUsageSnapshot {
  const keySet = new Set(sessionKeys);
  const usage: BudgetUsageSnapshot = { tokensIn: 0, tokensOut: 0, totalTokens: 0, cost: 0 };

  for (const key of keySet) {
    const status = statusBySessionKey.get(key);
    if (!status) {
      continue;
    }

    usage.tokensIn += status.tokensIn ?? 0;
    usage.tokensOut += status.tokensOut ?? 0;
    usage.totalTokens += (status.tokensIn ?? 0) + (status.tokensOut ?? 0);
    usage.cost += status.cost ?? 0;
  }

  return usage;
}

function evaluateBudget(
  scope: BudgetScope,
  scopeId: string,
  label: string,
  thresholds: BudgetThresholds,
  usage: BudgetUsageSnapshot,
): BudgetEvaluation {
  const metrics: BudgetMetricEvaluation[] = [];
  const warnRatio = thresholds.warnRatio ?? DEFAULT_WARN_RATIO;

  addMetric(metrics, "tokensIn", usage.tokensIn, thresholds.tokensIn, warnRatio);
  addMetric(metrics, "tokensOut", usage.tokensOut, thresholds.tokensOut, warnRatio);
  addMetric(metrics, "totalTokens", usage.totalTokens, thresholds.totalTokens, warnRatio);
  addMetric(metrics, "cost", usage.cost, thresholds.cost, warnRatio);

  return {
    scope,
    scopeId,
    label,
    thresholds,
    usage,
    metrics,
    status: highestStatus(metrics),
  };
}

function resolveThresholds(
  scope: BudgetScope,
  scopeId: string,
  raw: BudgetThresholds,
  policy: BudgetPolicyConfig,
): BudgetThresholds {
  const scopeOverrides =
    scope === "agent"
      ? policy.agent[scopeId]
      : scope === "project"
        ? policy.project[scopeId]
        : scope === "task"
          ? policy.task[scopeId]
          : undefined;

  return normalizeThresholds({
    ...policy.defaults,
    ...scopeOverrides,
    ...raw,
  });
}

function addMetric(
  metrics: BudgetMetricEvaluation[],
  metric: BudgetDimension,
  used: number,
  limit: number | undefined,
  warnRatio: number,
): void {
  if (limit === undefined || limit <= 0) {
    return;
  }
  const warnAt = limit * warnRatio;

  let status: BudgetStatus = "ok";
  if (used > limit) {
    status = "over";
  } else if (used >= warnAt) {
    status = "warn";
  }

  metrics.push({
    metric,
    used,
    limit,
    warnAt,
    status,
  });
}

function highestStatus(metrics: BudgetMetricEvaluation[]): BudgetStatus {
  if (metrics.some((metric) => metric.status === "over")) {
    return "over";
  }
  if (metrics.some((metric) => metric.status === "warn")) {
    return "warn";
  }
  return "ok";
}

function normalizeThresholds(input: BudgetThresholds): BudgetThresholds {
  const warnRatio = input.warnRatio;

  return {
    tokensIn: asPositiveNumber(input.tokensIn),
    tokensOut: asPositiveNumber(input.tokensOut),
    totalTokens: asPositiveNumber(input.totalTokens),
    cost: asPositiveNumber(input.cost),
    warnRatio:
      typeof warnRatio === "number" && Number.isFinite(warnRatio) && warnRatio > 0 && warnRatio < 1
        ? warnRatio
        : DEFAULT_WARN_RATIO,
  };
}

function asPositiveNumber(input: number | undefined): number | undefined {
  if (typeof input !== "number" || !Number.isFinite(input) || input <= 0) {
    return undefined;
  }
  return input;
}
