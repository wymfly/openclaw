import { describe, expect, it } from "vitest";
import {
  computeBudgetSummary,
  evaluateBudgetRule,
  type BudgetRule,
  type SessionSummary,
  type SessionStatusSnapshot,
  type TaskStoreSnapshot,
  type ProjectStoreSnapshot,
  type BudgetPolicyConfig,
} from "./budget-governance.js";

describe("budget-governance", () => {
  describe("evaluateBudgetRule", () => {
    const baseRule: BudgetRule = {
      id: "rule-1",
      name: "Test Rule",
      scope: "global",
      dimension: "cost",
      warnThreshold: 80,
      overThreshold: 100,
      period: "monthly",
      enabled: 1,
    };

    it("should return 'ok' when usage is below warn threshold", () => {
      const result = evaluateBudgetRule(baseRule, 50);
      expect(result.status).toBe("ok");
      expect(result.current).toBe(50);
    });

    it("should return 'warn' when usage equals warn threshold", () => {
      const result = evaluateBudgetRule(baseRule, 80);
      expect(result.status).toBe("warn");
    });

    it("should return 'warn' when usage is between warn and over thresholds", () => {
      const result = evaluateBudgetRule(baseRule, 95);
      expect(result.status).toBe("warn");
    });

    it("should return 'over' when usage exceeds over threshold", () => {
      const result = evaluateBudgetRule(baseRule, 150);
      expect(result.status).toBe("over");
    });

    it("should return 'ok' when thresholds are undefined", () => {
      const rule: BudgetRule = {
        ...baseRule,
        warnThreshold: undefined,
        overThreshold: undefined,
      };
      const result = evaluateBudgetRule(rule, 999);
      expect(result.status).toBe("ok");
    });
  });

  describe("computeBudgetSummary", () => {
    const sessions: SessionSummary[] = [
      { sessionKey: "s1", agentId: "agent-a" },
      { sessionKey: "s2", agentId: "agent-a" },
      { sessionKey: "s3", agentId: "agent-b" },
    ];

    const statuses: SessionStatusSnapshot[] = [
      { sessionKey: "s1", tokensIn: 500, tokensOut: 200, cost: 0.5 },
      { sessionKey: "s2", tokensIn: 300, tokensOut: 100, cost: 0.3 },
      { sessionKey: "s3", tokensIn: 1000, tokensOut: 500, cost: 1.0 },
    ];

    const tasks: TaskStoreSnapshot = {
      tasks: [
        {
          taskId: "task-1",
          projectId: "proj-1",
          title: "Build Feature",
          sessionKeys: ["s1", "s2"],
          budget: { cost: 2.0 },
        },
      ],
      agentBudgets: [
        {
          agentId: "agent-a",
          label: "Agent A",
          thresholds: { cost: 1.0 },
        },
        {
          agentId: "agent-b",
          label: "Agent B",
          thresholds: { cost: 2.0 },
        },
      ],
    };

    const projects: ProjectStoreSnapshot = {
      projects: [
        {
          projectId: "proj-1",
          title: "Project Alpha",
          budget: { cost: 5.0 },
        },
      ],
    };

    it("should return 'ok' status when all usage is below thresholds", () => {
      // Use very high thresholds in raw data so everything is ok
      const highTasks: TaskStoreSnapshot = {
        tasks: [
          {
            taskId: "task-1",
            projectId: "proj-1",
            title: "Build Feature",
            sessionKeys: ["s1", "s2"],
            budget: { cost: 100 },
          },
        ],
        agentBudgets: [
          { agentId: "agent-a", label: "Agent A", thresholds: { cost: 100 } },
          { agentId: "agent-b", label: "Agent B", thresholds: { cost: 100 } },
        ],
      };
      const highProjects: ProjectStoreSnapshot = {
        projects: [{ projectId: "proj-1", title: "Project Alpha", budget: { cost: 100 } }],
      };
      const summary = computeBudgetSummary(sessions, statuses, highTasks, highProjects);
      expect(summary.total).toBeGreaterThan(0);
      // All costs are well below 100
      expect(summary.ok).toBe(summary.total);
      expect(summary.warn).toBe(0);
      expect(summary.over).toBe(0);
    });

    it("should detect 'warn' when usage approaches threshold", () => {
      // Agent A: cost = 0.5 + 0.3 = 0.8, threshold = 1.0, warnAt = 0.8 -> warn
      const summary = computeBudgetSummary(sessions, statuses, tasks, projects);
      const agentA = summary.evaluations.find(
        (e) => e.scope === "agent" && e.scopeId === "agent-a",
      );
      expect(agentA).toBeDefined();
      expect(agentA!.status).toBe("warn");
    });

    it("should detect 'over' when usage exceeds threshold", () => {
      const highStatuses: SessionStatusSnapshot[] = [
        { sessionKey: "s1", tokensIn: 500, tokensOut: 200, cost: 0.8 },
        { sessionKey: "s2", tokensIn: 300, tokensOut: 100, cost: 0.5 },
        { sessionKey: "s3", tokensIn: 1000, tokensOut: 500, cost: 1.0 },
      ];

      // Agent A: cost = 0.8 + 0.5 = 1.3, threshold = 1.0 -> over
      const summary = computeBudgetSummary(sessions, highStatuses, tasks, projects);
      const agentA = summary.evaluations.find(
        (e) => e.scope === "agent" && e.scopeId === "agent-a",
      );
      expect(agentA).toBeDefined();
      expect(agentA!.status).toBe("over");
      expect(summary.over).toBeGreaterThan(0);
    });

    it("should evaluate per-agent scope correctly", () => {
      const summary = computeBudgetSummary(sessions, statuses, tasks, projects);

      // Agent B: cost = 1.0, threshold = 2.0, warnAt = 1.6 -> ok
      const agentB = summary.evaluations.find(
        (e) => e.scope === "agent" && e.scopeId === "agent-b",
      );
      expect(agentB).toBeDefined();
      expect(agentB!.status).toBe("ok");
    });

    it("should evaluate per-task scope", () => {
      const summary = computeBudgetSummary(sessions, statuses, tasks, projects);

      const task1 = summary.evaluations.find((e) => e.scope === "task" && e.scopeId === "task-1");
      expect(task1).toBeDefined();
      // Task 1 uses sessions s1 + s2: cost = 0.5 + 0.3 = 0.8, threshold = 2.0, warnAt = 1.6 -> ok
      expect(task1!.status).toBe("ok");
    });

    it("should evaluate per-project scope", () => {
      const summary = computeBudgetSummary(sessions, statuses, tasks, projects);

      const proj = summary.evaluations.find((e) => e.scope === "project" && e.scopeId === "proj-1");
      expect(proj).toBeDefined();
      // Project aggregates task sessions: s1 + s2, cost = 0.8, threshold = 5.0, warnAt = 4.0 -> ok
      expect(proj!.status).toBe("ok");
    });

    it("should handle empty inputs", () => {
      const emptyTasks: TaskStoreSnapshot = { tasks: [], agentBudgets: [] };
      const emptyProjects: ProjectStoreSnapshot = { projects: [] };
      const summary = computeBudgetSummary([], [], emptyTasks, emptyProjects);
      expect(summary.total).toBe(0);
      expect(summary.ok).toBe(0);
      expect(summary.warn).toBe(0);
      expect(summary.over).toBe(0);
      expect(summary.evaluations).toHaveLength(0);
    });

    it("should respect policy overrides per agent", () => {
      // Raw thresholds are merged last and win, so we need the raw thresholds
      // to NOT specify cost, letting the policy override take effect.
      const noRawCostTasks: TaskStoreSnapshot = {
        tasks: [],
        agentBudgets: [
          {
            agentId: "agent-b",
            label: "Agent B",
            thresholds: {}, // No raw cost threshold — policy override will apply
          },
        ],
      };

      const policy: BudgetPolicyConfig = {
        defaults: { warnRatio: 0.8 },
        agent: {
          "agent-b": { cost: 0.5 }, // Very low threshold for agent B
        },
        project: {},
        task: {},
      };

      const summary = computeBudgetSummary(
        sessions,
        statuses,
        noRawCostTasks,
        { projects: [] },
        policy,
      );
      const agentB = summary.evaluations.find(
        (e) => e.scope === "agent" && e.scopeId === "agent-b",
      );
      expect(agentB).toBeDefined();
      // Agent B: cost = 1.0, policy override cost = 0.5 -> over
      expect(agentB!.status).toBe("over");
    });
  });
});
