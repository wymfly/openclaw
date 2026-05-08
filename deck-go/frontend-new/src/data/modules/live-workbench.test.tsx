// @vitest-environment jsdom
import { QueryClient } from "@tanstack/react-query";
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataFabricProvider } from "../client/scoped-query-provider";
import { dataFreshnessPolicies } from "../contracts/freshness";
import { executeBffQuerySource } from "../transport/bff";
import { activityKeys } from "./activity/keys";
import { applyActivityFeedInvalidation } from "./activity/projections";
import {
  activityEventsQueryOptions,
  monitorRunsQueryOptions,
  monitorRunDetailQueryOptions,
} from "./activity/queries";
import { alertsKeys } from "./alerts/keys";
import { isRunScopedAlertRule, useCreateAlertRuleMutation } from "./alerts/mutations";
import { alertRulesQueryOptions } from "./alerts/queries";
import { approvalsKeys } from "./approvals/keys";
import { useResolveApprovalMutation } from "./approvals/mutations";
import { applyApprovalQueueInvalidation } from "./approvals/projections";
import { pendingApprovalsQueryOptions } from "./approvals/queries";
import { budgetKeys } from "./budget/keys";
import { isRunScopedBudgetRule, useCreateBudgetRuleMutation } from "./budget/mutations";
import { budgetRulesQueryOptions } from "./budget/queries";
import { cronKeys } from "./cron/keys";
import { isRunScopedCronJob, useCreateCronJobMutation } from "./cron/mutations";
import { cronJobsQueryOptions, cronRunsQueryOptions } from "./cron/queries";
import { gatewayKeys } from "./gateway/keys";
import { useSubmitGatewayBatchMutation } from "./gateway/mutations";
import { gatewayDescribeQueryOptions, gatewayHealthQueryOptions } from "./gateway/queries";
import { logsKeys } from "./logs/keys";
import { applyLogTailInvalidation } from "./logs/projections";
import { logsTailQueryOptions } from "./logs/queries";
import { sessionsKeys } from "./sessions/keys";
import { usePatchSessionMutation } from "./sessions/mutations";
import { applySessionListInvalidation } from "./sessions/projections";
import { sessionDetailQueryOptions, sessionsListQueryOptions } from "./sessions/queries";
import { threadsKeys } from "./threads/keys";
import { threadsListQueryOptions } from "./threads/queries";
import { usageKeys } from "./usage/keys";
import { usageCostQueryOptions, usageSessionLogsQueryOptions } from "./usage/queries";
import { webhooksKeys } from "./webhooks/keys";
import { isRunScopedWebhook, useCreateWebhookMutation } from "./webhooks/mutations";
import { webhookDeliveriesQueryOptions, webhooksListQueryOptions } from "./webhooks/queries";

const apiMocks = vi.hoisted(() => ({
  createAlertRule: vi.fn(),
  createBudgetRule: vi.fn(),
  createCronJob: vi.fn(),
  createWebhook: vi.fn(),
  fetchActivityEvents: vi.fn(),
  fetchAlertRules: vi.fn(),
  fetchBudgetRules: vi.fn(),
  fetchCronJobs: vi.fn(),
  fetchCronRuns: vi.fn(),
  fetchGatewayDescribe: vi.fn(),
  fetchGatewayHealth: vi.fn(),
  fetchLogsTail: vi.fn(),
  fetchMonitorRunDetail: vi.fn(),
  fetchMonitorRuns: vi.fn(),
  fetchPendingApprovals: vi.fn(),
  fetchSessionDetail: vi.fn(),
  fetchChatHistory: vi.fn(),
  fetchSessions: vi.fn(),
  fetchUsageSessionLogs: vi.fn(),
  fetchModelUsageCost: vi.fn(),
  fetchWebhookDeliveries: vi.fn(),
  fetchWebhooks: vi.fn(),
  patchSession: vi.fn(),
  resolveApproval: vi.fn(),
  submitGatewayBatch: vi.fn(),
}));

vi.mock("@/api", () => apiMocks);

type MutationHandles = {
  createAlert: ReturnType<typeof useCreateAlertRuleMutation>;
  createBudget: ReturnType<typeof useCreateBudgetRuleMutation>;
  createCron: ReturnType<typeof useCreateCronJobMutation>;
  createWebhook: ReturnType<typeof useCreateWebhookMutation>;
  patchSession: ReturnType<typeof usePatchSessionMutation>;
  resolveApproval: ReturnType<typeof useResolveApprovalMutation>;
  submitGatewayBatch: ReturnType<typeof useSubmitGatewayBatchMutation>;
};

let container: HTMLDivElement;
let root: Root | null = null;
let queryClient: QueryClient;
let handles: MutationHandles | null = null;

function MutationProbe({ onReady }: { onReady: (handles: MutationHandles) => void }) {
  const createAlert = useCreateAlertRuleMutation();
  const createBudget = useCreateBudgetRuleMutation();
  const createCron = useCreateCronJobMutation();
  const createWebhook = useCreateWebhookMutation();
  const patchSession = usePatchSessionMutation();
  const resolveApproval = useResolveApprovalMutation();
  const submitGatewayBatch = useSubmitGatewayBatchMutation();

  useEffect(() => {
    onReady({
      createAlert,
      createBudget,
      createCron,
      createWebhook,
      patchSession,
      resolveApproval,
      submitGatewayBatch,
    });
  }, [
    createAlert,
    createBudget,
    createCron,
    createWebhook,
    onReady,
    patchSession,
    resolveApproval,
    submitGatewayBatch,
  ]);

  return null;
}

async function renderMutationProbe() {
  await act(async () => {
    root = createRoot(container);
    root.render(
      createElement(
        DataFabricProvider,
        { queryClient },
        createElement(MutationProbe, {
          onReady(next) {
            handles = next;
          },
        }),
      ),
    );
  });
  if (!handles) {
    throw new Error("mutation handles did not initialize");
  }
  return handles;
}

describe("live workbench Data Fabric modules", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    handles = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    root = null;
    container.remove();
  });

  it("exposes stable serializable keys for every scoped live workbench module", () => {
    const keys = [
      activityKeys.events(100),
      activityKeys.monitorRuns({ agentId: "main", status: "ok" }),
      gatewayKeys.health(),
      usageKeys.sessions({ limit: 50, startDate: "2026-05-01" }),
      usageKeys.sessionLogs({ key: "sess-main", limit: 50 }),
      logsKeys.tail({ cursor: 1, limit: 200, maxBytes: 65536 }),
      threadsKeys.list({ channel: "wecom", status: "active" }),
      approvalsKeys.pending(),
      sessionsKeys.list({ limit: 200, search: "build" }),
      sessionsKeys.previews(["b", "a"]),
      alertsKeys.list(),
      budgetKeys.rules(),
      cronKeys.jobs({ includeDisabled: true }),
      cronKeys.runs("job-a", { limit: 20, sortDir: "desc" }),
      webhooksKeys.deliveries("hook-a"),
    ];

    for (const key of keys) {
      expect(() => JSON.stringify(key)).not.toThrow();
      expect(JSON.parse(JSON.stringify(key))[0]).toBe("deck-go");
    }
  });

  it("maps representative reads to contract-derived freshness tiers", () => {
    expect(gatewayHealthQueryOptions(executeBffQuerySource).staleTime).toBe(
      dataFreshnessPolicies["runtime-liveness"].staleTime,
    );
    expect(gatewayDescribeQueryOptions(executeBffQuerySource).staleTime).toBe(
      dataFreshnessPolicies["lazy-detail"].staleTime,
    );
    expect(sessionsListQueryOptions(executeBffQuerySource).staleTime).toBe(
      dataFreshnessPolicies["live-workbench"].staleTime,
    );
    expect(sessionDetailQueryOptions(executeBffQuerySource, { sessionKey: "sess" }).staleTime).toBe(
      dataFreshnessPolicies["lazy-detail"].staleTime,
    );
    expect(activityEventsQueryOptions(executeBffQuerySource).staleTime).toBe(
      dataFreshnessPolicies.historical.staleTime,
    );
    expect(monitorRunsQueryOptions(executeBffQuerySource).staleTime).toBe(
      dataFreshnessPolicies["live-workbench"].staleTime,
    );
    expect(monitorRunDetailQueryOptions(executeBffQuerySource, "run-a").staleTime).toBe(
      dataFreshnessPolicies["lazy-detail"].staleTime,
    );
    expect(usageCostQueryOptions(executeBffQuerySource, 14).staleTime).toBe(
      dataFreshnessPolicies.historical.staleTime,
    );
    expect(usageSessionLogsQueryOptions(executeBffQuerySource, { key: "sess" }).staleTime).toBe(
      dataFreshnessPolicies.historical.staleTime,
    );
    expect(logsTailQueryOptions(executeBffQuerySource).staleTime).toBe(
      dataFreshnessPolicies["stream-driven"].staleTime,
    );
    expect(threadsListQueryOptions(executeBffQuerySource).staleTime).toBe(
      dataFreshnessPolicies.inventory.staleTime,
    );
    expect(pendingApprovalsQueryOptions(executeBffQuerySource).staleTime).toBe(
      dataFreshnessPolicies["live-workbench"].staleTime,
    );
    expect(alertRulesQueryOptions(executeBffQuerySource).staleTime).toBe(
      dataFreshnessPolicies.inventory.staleTime,
    );
    expect(budgetRulesQueryOptions(executeBffQuerySource).staleTime).toBe(
      dataFreshnessPolicies.inventory.staleTime,
    );
    expect(cronJobsQueryOptions(executeBffQuerySource).staleTime).toBe(
      dataFreshnessPolicies["live-workbench"].staleTime,
    );
    expect(cronRunsQueryOptions(executeBffQuerySource, "job-a").staleTime).toBe(
      dataFreshnessPolicies.historical.staleTime,
    );
    expect(webhooksListQueryOptions(executeBffQuerySource).staleTime).toBe(
      dataFreshnessPolicies.inventory.staleTime,
    );
    expect(webhookDeliveriesQueryOptions(executeBffQuerySource, "hook-a").staleTime).toBe(
      dataFreshnessPolicies.historical.staleTime,
    );
  });

  it("returns fresh cache and preserves cached data after a background refresh error", async () => {
    apiMocks.fetchActivityEvents.mockResolvedValueOnce({ events: [{ id: "evt-1" }] });
    await queryClient.fetchQuery(activityEventsQueryOptions(executeBffQuerySource, 100));
    await queryClient.fetchQuery(activityEventsQueryOptions(executeBffQuerySource, 100));
    expect(apiMocks.fetchActivityEvents).toHaveBeenCalledTimes(1);

    apiMocks.fetchActivityEvents.mockRejectedValueOnce(new Error("activity unavailable"));
    await queryClient.refetchQueries({ queryKey: activityKeys.events(100) });

    expect(queryClient.getQueryData(activityKeys.events(100))).toEqual({
      events: [{ id: "evt-1" }],
    });
    expect(apiMocks.fetchActivityEvents).toHaveBeenCalledTimes(2);
  });

  it("keeps diagnostic Gateway actions user-triggered and invalidates scoped mutation keys", async () => {
    const mutations = await renderMutationProbe();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    apiMocks.createAlertRule.mockResolvedValue({ rule: { id: "alert-run-1" } });
    apiMocks.createBudgetRule.mockResolvedValue({ id: "budget-run-1" });
    apiMocks.createCronJob.mockResolvedValue({ id: "cron-run-1" });
    apiMocks.createWebhook.mockResolvedValue({ id: "webhook-run-1" });
    apiMocks.patchSession.mockResolvedValue({ ok: true, sessionKey: "sess-main" });
    apiMocks.resolveApproval.mockResolvedValue({ ok: true });
    apiMocks.submitGatewayBatch.mockResolvedValue({ ok: true, results: [] });

    await mutations.createAlert.mutateAsync({
      action: "activity",
      condition: "errors > 1",
      cooldownMs: 60_000,
      entityType: "run",
      enabled: true,
      name: "df-run-alert",
      threshold: 1,
    });
    await mutations.createBudget.mutateAsync({
      agentId: null,
      dimension: "cost",
      enabled: true,
      name: "df-run-budget",
      overThreshold: 100,
      period: "daily",
      scope: "global",
      taskId: null,
      warnThreshold: 80,
    });
    await mutations.createCron.mutateAsync({
      enabled: false,
      name: "df-run-cron",
      payload: { kind: "systemEvent", text: "status" },
      schedule: { expr: "0 0 1 1 *", kind: "cron", tz: "UTC" },
      sessionTarget: "main",
      wakeMode: "now",
    });
    await mutations.createWebhook.mutateAsync({
      enabled: true,
      events: ["activity.event"],
      name: "df-run-webhook",
      url: "https://example.invalid/hook",
    });
    await mutations.patchSession.mutateAsync({
      metadata: { title: "Updated" },
      sessionKey: "sess-main",
    });
    await mutations.resolveApproval.mutateAsync({ decision: "deny", id: "approval-a" });
    await mutations.submitGatewayBatch.mutateAsync({ request: { calls: [] } });

    expect(apiMocks.submitGatewayBatch).toHaveBeenCalledWith(
      { calls: [] },
      { runtimeId: undefined },
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: alertsKeys.all() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: budgetKeys.all() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: cronKeys.all() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: webhooksKeys.all() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: sessionsKeys.all() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: approvalsKeys.all() });
  });

  it("exposes fixture-safety helpers for real E2E destructive write guards", () => {
    expect(isRunScopedAlertRule({ id: "alert-run-42", name: "Smoke" }, "run-42")).toBe(true);
    expect(isRunScopedBudgetRule({ id: "budget-1", name: "df-run-42 budget" }, "run-42")).toBe(
      true,
    );
    expect(isRunScopedWebhook({ id: "hook-1", name: "df-run-42 hook" }, "run-42")).toBe(true);
    expect(
      isRunScopedCronJob({ description: "df-run-42", id: "cron-1", name: "nightly" }, "run-42"),
    ).toBe(true);
    expect(isRunScopedAlertRule({ id: "alert-prod", name: "Production" }, "run-42")).toBe(false);
  });

  it("invalidates projection-owned query keys without generated patch fields", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await applyActivityFeedInvalidation(queryClient, {
      projection: "activity-feed",
      type: "projection.gap",
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: activityKeys.events() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: activityKeys.monitorRuns() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: activityKeys.monitorStats() });

    invalidate.mockClear();
    await applyApprovalQueueInvalidation(queryClient, {
      projection: "approval-queue",
      type: "approval.pending",
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: approvalsKeys.pending() });

    invalidate.mockClear();
    await applySessionListInvalidation(queryClient, {
      projection: "session-list",
      sessionKey: "sess-main",
      type: "session-state",
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: sessionsKeys.all() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: sessionsKeys.detail("sess-main") });

    invalidate.mockClear();
    await applyLogTailInvalidation(queryClient, {
      projection: "log-tail",
      type: "projection.gap",
    });
    expect(invalidate).not.toHaveBeenCalled();

    await applyLogTailInvalidation(queryClient, {
      projection: "log-tail",
      type: "log.reset",
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: logsKeys.all() });
  });
});
