import { describe, expect, it } from "vitest";
import {
  acknowledgeMutationResponse,
  getMutationActionContract,
  mutationErrorEvidence,
  mutationEvidenceForResponse,
} from "./mutation-evidence";

describe("mutation evidence helpers", () => {
  it("extracts response target ids without replacing DTOs", () => {
    const response = { rule: { id: "alert-1", name: "CPU" } };

    expect(mutationEvidenceForResponse("alert.rule.create", response)).toMatchObject({
      actionId: "alert.rule.create",
      fixtureSafety: "fixture-safe",
      ok: true,
      targetId: "alert-1",
    });
    expect(acknowledgeMutationResponse("alert.rule.create", response)).toBe(response);
  });

  it("extracts route target ids for delete responses", () => {
    expect(
      mutationEvidenceForResponse(
        "webhook.delete",
        { deleted: true },
        { routeParams: { id: "wh-1" } },
      ),
    ).toMatchObject({
      ok: true,
      targetId: "wh-1",
    });

    expect(
      mutationEvidenceForResponse(
        "webhook.test-delivery",
        { success: true, deliveryId: "delivery-1", statusCode: 200 },
        { routeParams: { id: "wh-1" } },
      ),
    ).toMatchObject({
      actionId: "webhook.test-delivery",
      ok: true,
      targetId: "wh-1",
    });
  });

  it("records docs extract and delete action safety", () => {
    expect(
      mutationEvidenceForResponse("docs.extract", {
        extracted: 1,
        docs: [{ id: "doc-1" }],
      }),
    ).toMatchObject({
      actionId: "docs.extract",
      fixtureSafety: "skipped-safe",
      ok: true,
      targetId: "doc-1",
    });

    expect(
      mutationEvidenceForResponse("docs.delete", { ok: true }, { routeParams: { docId: "doc-1" } }),
    ).toMatchObject({
      actionId: "docs.delete",
      fixtureSafety: "skipped-safe",
      ok: true,
      targetId: "doc-1",
    });
  });

  it("records skills mutation safety by action", () => {
    expect(
      mutationEvidenceForResponse(
        "skills.update",
        { ok: true, skillKey: "github" },
        { routeParams: { skillKey: "github" } },
      ),
    ).toMatchObject({
      actionId: "skills.update",
      conflictBehavior: "upstream-preserved",
      fixtureSafety: "deferred",
      ok: true,
      targetId: "github",
    });

    expect(
      mutationEvidenceForResponse("skills.install", {
        ok: true,
        message: "installed",
        stdout: "",
        stderr: "",
        code: 0,
        slug: "git-helper",
      }),
    ).toMatchObject({
      actionId: "skills.install",
      fixtureSafety: "skipped-safe",
      ok: true,
      targetId: "git-helper",
    });

    expect(
      mutationEvidenceForResponse("skills.hub.update", { ok: true, skillKey: "*" }),
    ).toMatchObject({
      actionId: "skills.hub.update",
      fixtureSafety: "skipped-safe",
      ok: true,
      targetId: "*",
    });
  });

  it("records cron write and manual run action safety", () => {
    expect(mutationEvidenceForResponse("cron.create", { id: "job-1" })).toMatchObject({
      actionId: "cron.create",
      conflictBehavior: "upstream-preserved",
      fixtureSafety: "fixture-safe",
      ok: true,
      targetId: "job-1",
    });

    expect(mutationEvidenceForResponse("cron.update", { id: "job-1" })).toMatchObject({
      actionId: "cron.update",
      conflictBehavior: "upstream-preserved",
      fixtureSafety: "fixture-safe",
      ok: true,
      targetId: "job-1",
    });

    expect(
      mutationEvidenceForResponse(
        "cron.delete",
        { ok: true, removed: true },
        { routeParams: { jobId: "job-1" } },
      ),
    ).toMatchObject({
      actionId: "cron.delete",
      conflictBehavior: "upstream-preserved",
      fixtureSafety: "fixture-safe",
      ok: true,
      targetId: "job-1",
    });

    expect(
      mutationEvidenceForResponse(
        "cron.run",
        { ok: true, ran: false, reason: "invalid-spec" },
        { routeParams: { jobId: "job-1" } },
      ),
    ).toMatchObject({
      actionId: "cron.run",
      conflictBehavior: "upstream-preserved",
      fixtureSafety: "skipped-safe",
      ok: true,
      targetId: "job-1",
    });
  });

  it("fails on unknown action ids", () => {
    expect(() => getMutationActionContract("missing.action" as never)).toThrow(
      /unknown mutation evidence action/,
    );
  });

  it("keeps validation-only failures out of conflict state", () => {
    expect(mutationErrorEvidence("budget.rule.update", new Error("stale hash"))).toMatchObject({
      actionId: "budget.rule.update",
      conflict: false,
      conflictBehavior: "validation-only",
      message: "stale hash",
    });
  });

  it("marks agents config saves as contract-known conflict-capable mutations", () => {
    expect(
      mutationEvidenceForResponse("agents.skills.save", {
        ok: true,
        agentId: "main",
        configHash: "hash-2",
      }),
    ).toMatchObject({
      actionId: "agents.skills.save",
      conflictBehavior: "config-write-safety",
      fixtureSafety: "deferred",
      ok: true,
      targetId: "main",
    });

    expect(mutationErrorEvidence("agents.skills.save", new Error("409 stale hash"))).toMatchObject({
      conflict: true,
      conflictBehavior: "config-write-safety",
    });
  });

  it("uses route ids for subagent steer evidence", () => {
    expect(
      mutationEvidenceForResponse(
        "subagents.steer",
        { success: true, newRunId: "run-child" },
        { routeParams: { runId: "run-root" } },
      ),
    ).toMatchObject({
      ok: true,
      targetId: "run-root",
    });
  });

  it("records chat seed actions as fixture-safe mutations", () => {
    expect(
      mutationEvidenceForResponse("chat.session.create", { ok: true, key: "sess-1" }),
    ).toMatchObject({
      actionId: "chat.session.create",
      fixtureSafety: "fixture-safe",
      ok: true,
      targetId: "sess-1",
    });

    expect(
      mutationEvidenceForResponse(
        "chat.send",
        { status: "started", runId: "run-1" },
        { routeParams: { sessionKey: "sess-1" } },
      ),
    ).toMatchObject({
      actionId: "chat.send",
      conflictBehavior: "upstream-preserved",
      fixtureSafety: "fixture-safe",
      ok: true,
      targetId: "sess-1",
    });
  });

  it("records destructive session mutations as deferred", () => {
    expect(
      mutationEvidenceForResponse(
        "chat.session.delete",
        { ok: true, key: "sess-1" },
        { routeParams: { sessionKey: "sess-1" } },
      ),
    ).toMatchObject({
      actionId: "chat.session.delete",
      fixtureSafety: "deferred",
      ok: true,
      targetId: "sess-1",
    });

    expect(mutationErrorEvidence("chat.session.patch", new Error("stale session"))).toMatchObject({
      conflict: true,
      conflictBehavior: "upstream-preserved",
    });
  });

  it("records models config save and provider probe action safety", () => {
    expect(
      mutationEvidenceForResponse("models.config.save", { ok: true, hash: "h2" }),
    ).toMatchObject({
      actionId: "models.config.save",
      conflictBehavior: "config-write-safety",
      fixtureSafety: "deferred",
      ok: true,
      targetId: "h2",
    });

    expect(
      mutationEvidenceForResponse("models.auth.probe", {
        provider: "openai",
        status: "ok",
      }),
    ).toMatchObject({
      actionId: "models.auth.probe",
      conflictBehavior: "upstream-preserved",
      fixtureSafety: "skipped-safe",
      ok: true,
      targetId: "openai",
    });
  });

  it("records channels probe, logout, and config patch action safety", () => {
    expect(
      mutationEvidenceForResponse(
        "channels.probe",
        { ok: true, channelId: "telegram", check: "probe" },
        { routeParams: { channelId: "telegram" } },
      ),
    ).toMatchObject({
      actionId: "channels.probe",
      conflictBehavior: "upstream-preserved",
      fixtureSafety: "skipped-safe",
      ok: true,
      targetId: "telegram",
    });

    expect(
      mutationEvidenceForResponse(
        "channels.logout",
        { channel: "telegram", accountId: "default", cleared: true },
        { routeParams: { channelId: "telegram" } },
      ),
    ).toMatchObject({
      actionId: "channels.logout",
      conflictBehavior: "upstream-preserved",
      fixtureSafety: "skipped-safe",
      ok: true,
      targetId: "telegram",
    });

    expect(
      mutationEvidenceForResponse(
        "channels.config.patch",
        { ok: true, hash: "h2" },
        { routeParams: { channelId: "telegram" } },
      ),
    ).toMatchObject({
      actionId: "channels.config.patch",
      conflictBehavior: "config-write-safety",
      fixtureSafety: "deferred",
      ok: true,
      targetId: "telegram",
    });
  });

  it("records routing and identity config-write action safety", () => {
    expect(
      mutationEvidenceForResponse(
        "identity.link",
        { ok: true, configHash: "identity-hash-2" },
        { routeParams: { canonical: "user:1" } },
      ),
    ).toMatchObject({
      actionId: "identity.link",
      conflictBehavior: "config-write-safety",
      fixtureSafety: "deferred",
      ok: true,
      targetId: "user:1",
    });

    expect(
      mutationEvidenceForResponse(
        "identity.unlink",
        { ok: true, configHash: "identity-hash-3" },
        { routeParams: { canonical: "user:1" } },
      ),
    ).toMatchObject({
      actionId: "identity.unlink",
      conflictBehavior: "config-write-safety",
      fixtureSafety: "deferred",
      ok: true,
      targetId: "user:1",
    });

    expect(
      mutationEvidenceForResponse("routing.add", {
        ok: true,
        binding: { id: "route-1" },
        configHash: "routing-hash-2",
        warnings: [],
      }),
    ).toMatchObject({
      actionId: "routing.add",
      conflictBehavior: "config-write-safety",
      fixtureSafety: "deferred",
      ok: true,
      targetId: "route-1",
    });

    expect(
      mutationEvidenceForResponse("routing.remove", {
        ok: true,
        removed: { id: "route-1" },
        configHash: "routing-hash-3",
        impact: "messages will fall through",
      }),
    ).toMatchObject({
      actionId: "routing.remove",
      conflictBehavior: "config-write-safety",
      fixtureSafety: "deferred",
      ok: true,
      targetId: "route-1",
    });

    expect(
      mutationEvidenceForResponse("routing.dm-scope.patch", {
        ok: true,
        hash: "routing-scope-hash",
      }),
    ).toMatchObject({
      actionId: "routing.dm-scope.patch",
      conflictBehavior: "config-write-safety",
      fixtureSafety: "deferred",
      ok: true,
      targetId: "routing-scope-hash",
    });
  });

  it("records approval policy and decision action safety", () => {
    expect(
      mutationEvidenceForResponse("approvals.policy.save", {
        hash: "policy-hash-2",
        file: { defaults: { ask: "always" } },
      }),
    ).toMatchObject({
      actionId: "approvals.policy.save",
      conflictBehavior: "config-write-safety",
      fixtureSafety: "deferred",
      ok: true,
      targetId: "policy-hash-2",
    });

    expect(
      mutationEvidenceForResponse(
        "approvals.exec.resolve",
        { ok: true },
        { routeParams: { approvalId: "approval-build" } },
      ),
    ).toMatchObject({
      actionId: "approvals.exec.resolve",
      conflictBehavior: "upstream-preserved",
      fixtureSafety: "skipped-safe",
      ok: true,
      targetId: "approval-build",
    });

    expect(
      mutationEvidenceForResponse(
        "approvals.plugin.resolve",
        { ok: true },
        { routeParams: { approvalId: "plugin-ap-main" } },
      ),
    ).toMatchObject({
      actionId: "approvals.plugin.resolve",
      conflictBehavior: "upstream-preserved",
      fixtureSafety: "skipped-safe",
      ok: true,
      targetId: "plugin-ap-main",
    });

    expect(mutationErrorEvidence("approvals.policy.save", new Error("stale hash"))).toMatchObject({
      conflict: true,
      conflictBehavior: "config-write-safety",
    });
  });

  it("records node command and pairing action safety", () => {
    expect(
      mutationEvidenceForResponse(
        "nodes.rename",
        { nodeId: "node-1", displayName: "Renamed" },
        { routeParams: { nodeId: "node-1" } },
      ),
    ).toMatchObject({
      actionId: "nodes.rename",
      fixtureSafety: "skipped-safe",
      ok: true,
      targetId: "node-1",
    });

    expect(
      mutationEvidenceForResponse(
        "nodes.invoke",
        { ok: true, nodeId: "node-1", command: "system.notify", payloadJSON: null },
        { routeParams: { nodeId: "node-1" } },
      ),
    ).toMatchObject({
      actionId: "nodes.invoke",
      fixtureSafety: "skipped-safe",
      ok: true,
      targetId: "node-1",
    });

    expect(
      mutationEvidenceForResponse(
        "nodes.pending.enqueue",
        { nodeId: "node-1", queued: { id: "pending-1" }, revision: 1 },
        { routeParams: { nodeId: "node-1" } },
      ),
    ).toMatchObject({
      actionId: "nodes.pending.enqueue",
      fixtureSafety: "skipped-safe",
      ok: true,
      targetId: "node-1",
    });

    expect(
      mutationEvidenceForResponse("nodes.pair.request", {
        request: { requestId: "pair-1" },
        status: "pending",
      }),
    ).toMatchObject({
      actionId: "nodes.pair.request",
      fixtureSafety: "skipped-safe",
      ok: true,
      targetId: "pair-1",
    });

    expect(
      mutationEvidenceForResponse(
        "nodes.pair.approve",
        { requestId: "pair-1", node: { nodeId: "node-1" } },
        { routeParams: { requestId: "pair-1" } },
      ),
    ).toMatchObject({ ok: true, targetId: "pair-1" });

    expect(
      mutationEvidenceForResponse(
        "nodes.pair.reject",
        { requestId: "pair-1", nodeId: "node-1" },
        { routeParams: { requestId: "pair-1" } },
      ),
    ).toMatchObject({ ok: true, targetId: "pair-1" });

    expect(
      mutationEvidenceForResponse(
        "nodes.pair.verify",
        { ok: false },
        { routeParams: { nodeId: "node-1" } },
      ),
    ).toMatchObject({
      actionId: "nodes.pair.verify",
      fixtureSafety: "skipped-safe",
      ok: true,
      targetId: "node-1",
    });
  });
});
