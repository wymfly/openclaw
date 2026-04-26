import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeckGoPendingApproval } from "../../api";
import {
  fetchApprovalsPolicy,
  fetchPendingApprovals,
  resolveApproval as resolveApprovalRequest,
} from "../../api";
import { useApprovalsStore } from "../approvals";

vi.mock("../../api", () => ({
  fetchApprovalsPolicy: vi.fn(),
  fetchPendingApprovals: vi.fn(),
  resolveApproval: vi.fn(),
}));

const pending = (id: string, expiresAtMs = Date.now() + 60_000): DeckGoPendingApproval => ({
  id,
  command: `cmd-${id}`,
  createdAtMs: Date.now(),
  expiresAtMs,
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(1_000);
  useApprovalsStore.setState({
    pending: [],
    policy: null,
    policyHash: null,
    loading: false,
    error: null,
  });
});

describe("useApprovalsStore", () => {
  it("fetches pending approvals and filters expired entries", async () => {
    vi.mocked(fetchPendingApprovals).mockResolvedValue({
      pending: [pending("active", 2_000), pending("expired", 999)],
    });

    await useApprovalsStore.getState().fetchPending();

    expect(useApprovalsStore.getState().pending.map((approval) => approval.id)).toEqual(["active"]);
  });

  it("resolves an approval through the deck API and removes it from pending", async () => {
    vi.mocked(resolveApprovalRequest).mockResolvedValue({ ok: true });
    useApprovalsStore.setState({
      pending: [pending("approval-1"), pending("approval-2")],
    });

    const ok = await useApprovalsStore.getState().resolveApproval("approval-1", "deny");

    expect(ok).toBe(true);
    expect(resolveApprovalRequest).toHaveBeenCalledWith("approval-1", "deny");
    expect(useApprovalsStore.getState().pending.map((approval) => approval.id)).toEqual([
      "approval-2",
    ]);
  });

  it("normalizes fetched policy snapshots", async () => {
    vi.mocked(fetchApprovalsPolicy).mockResolvedValue({
      hash: "hash-1",
      file: {
        defaults: { ask: "always" },
        agents: { main: { security: "allowlist" } },
      },
    });

    await useApprovalsStore.getState().fetchPolicy();

    expect(useApprovalsStore.getState().policy).toEqual({
      defaults: { ask: "always" },
      agents: { main: { security: "allowlist" } },
      allowlist: [],
    });
    expect(useApprovalsStore.getState().policyHash).toBe("hash-1");
  });
});
