import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeckGoPendingApproval } from "../../api";
import { resolveApproval as resolveApprovalRequest } from "../../api";
import { useApprovalsStore } from "../approvals";

vi.mock("../../api", () => ({
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
  it("keeps stream-fed pending approvals active and de-duplicated", () => {
    useApprovalsStore.getState().addPending(pending("active", 2_000));
    useApprovalsStore.getState().addPending(pending("expired", 999));
    useApprovalsStore.getState().addPending(pending("active", 2_000));

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

  it("removes pending approvals by id when the live stream reports completion", () => {
    useApprovalsStore.setState({
      pending: [pending("approval-1"), pending("approval-2")],
    });

    useApprovalsStore.getState().removePending("approval-1");

    expect(useApprovalsStore.getState().pending.map((approval) => approval.id)).toEqual([
      "approval-2",
    ]);
  });
});
