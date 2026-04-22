import { useEffect, useMemo, useState } from "react";
import type {
  DeckGoApprovalPolicy,
  DeckGoApprovalPolicyResponse,
  DeckGoPendingApproval,
  DeckGoPendingApprovalsResponse,
} from "../../api";
import { fetchApprovalsPolicy, fetchPendingApprovals, resolveApproval } from "../../api";
import { JsonDetails, ShellStat } from "../../shell-components";

type PanelState = "idle" | "loading" | "ready";
type ApprovalDecision = "allow-once" | "allow-always" | "deny";

function normalizePolicy(
  response: DeckGoApprovalPolicyResponse | null,
): DeckGoApprovalPolicy | null {
  if (!response) {
    return null;
  }
  const file = response.file ?? {};
  return {
    defaults: file.defaults ?? {},
    agents: file.agents ?? {},
    allowlist: file.allowlist ?? [],
  };
}

function filterActivePendingApprovals(approvals: DeckGoPendingApproval[], now = Date.now()) {
  return approvals.filter(
    (approval) => !Number.isFinite(approval.expiresAtMs) || approval.expiresAtMs > now,
  );
}

export function RestoredApprovalsPanel() {
  const [policyResponse, setPolicyResponse] = useState<DeckGoApprovalPolicyResponse | null>(null);
  const [pendingResponse, setPendingResponse] = useState<DeckGoPendingApprovalsResponse | null>(
    null,
  );
  const [selectedApprovalId, setSelectedApprovalId] = useState("");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<ApprovalDecision | "idle">("idle");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [error, setError] = useState("");

  const refresh = async (preferredApprovalId?: string) => {
    setLoadState("loading");
    try {
      const [nextPolicy, nextPending] = await Promise.all([
        fetchApprovalsPolicy(),
        fetchPendingApprovals(),
      ]);
      setPolicyResponse(nextPolicy);
      setPendingResponse(nextPending);
      setLoadState("ready");
      setError("");
      const approvals = filterActivePendingApprovals(nextPending.pending ?? []);
      const fallbackId = preferredApprovalId?.trim() || approvals[0]?.id || "";
      setSelectedApprovalId((current) =>
        approvals.some((approval) => approval.id === current)
          ? current
          : approvals.some((approval) => approval.id === fallbackId)
            ? fallbackId
            : approvals[0]?.id || "",
      );
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load approvals");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const policy = useMemo(() => normalizePolicy(policyResponse), [policyResponse]);
  const pendingApprovals = useMemo(
    () => filterActivePendingApprovals(pendingResponse?.pending ?? []),
    [pendingResponse],
  );
  const selectedApproval =
    pendingApprovals.find((approval) => approval.id === selectedApprovalId) ??
    pendingApprovals[0] ??
    null;

  const runDecision = async (decision: ApprovalDecision) => {
    if (!selectedApproval) {
      return;
    }
    setActionState(decision);
    try {
      const result = await resolveApproval(selectedApproval.id, decision);
      setActionResult(result);
      setError("");
      await refresh(selectedApproval.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "approval action failed");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Pending approvals</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Vite-owned approvals slice over the live pending/policy contracts.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Approvals {loadState}
              </span>
              <span className="deckgo-pill">{pendingApprovals.length} pending</span>
              <span className="deckgo-pill">allowlist {policy?.allowlist.length ?? 0}</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3">
              <ShellStat label="pending" value={pendingApprovals.length} />
              <ShellStat label="agent overrides" value={Object.keys(policy?.agents ?? {}).length} />
              <ShellStat label="allowlist" value={policy?.allowlist.length ?? 0} />
            </div>
            <div className="deckgo-actions">
              <button
                className="deckgo-button"
                type="button"
                onClick={() => void refresh(selectedApprovalId)}
              >
                Refresh approvals
              </button>
              <button
                className="deckgo-button is-primary"
                type="button"
                onClick={() => void runDecision("allow-once")}
                disabled={!selectedApproval || actionState !== "idle"}
              >
                {actionState === "allow-once" ? "Allowing" : "Allow once"}
              </button>
              <button
                className="deckgo-button"
                type="button"
                onClick={() => void runDecision("allow-always")}
                disabled={!selectedApproval || actionState !== "idle"}
              >
                {actionState === "allow-always" ? "Saving" : "Allow always"}
              </button>
              <button
                className="deckgo-button is-danger"
                type="button"
                onClick={() => void runDecision("deny")}
                disabled={!selectedApproval || actionState !== "idle"}
              >
                {actionState === "deny" ? "Denying" : "Deny"}
              </button>
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            {pendingApprovals.length === 0 ? (
              <p className="deckgo-note">No pending approvals.</p>
            ) : (
              <ul className="deckgo-shell-list">
                {pendingApprovals.map((approval) => (
                  <li key={approval.id}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card ${selectedApproval?.id === approval.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedApprovalId(approval.id)}
                    >
                      <strong>{approval.command}</strong>
                      <div className="deckgo-meta">
                        id: {approval.id} | agent: {approval.agentId || "n/a"} | session:{" "}
                        {approval.sessionKey || "n/a"}
                      </div>
                      <div className="deckgo-meta">
                        expires: {new Date(approval.expiresAtMs).toLocaleString()}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-restored-chat-main">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected approval</h2>
          </div>
          <p className="deckgo-card-subtitle">
            The first approvals slice stays narrow: inspect pending requests, inspect policy, and
            take a direct allow/deny action.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            {selectedApproval ? (
              <>
                <div className="deckgo-restored-hero-strip">
                  <div>
                    <p className="deckgo-kicker">Command</p>
                    <strong>{selectedApproval.command}</strong>
                    <p className="deckgo-note">run: {selectedApproval.runId || "n/a"}</p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">agent {selectedApproval.agentId || "n/a"}</span>
                    <span className="deckgo-pill">
                      session {selectedApproval.sessionKey || "n/a"}
                    </span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2">
                  <ShellStat
                    label="created"
                    value={new Date(selectedApproval.createdAtMs).toLocaleString()}
                  />
                  <ShellStat
                    label="expires"
                    value={new Date(selectedApproval.expiresAtMs).toLocaleString()}
                  />
                </div>
                <JsonDetails title="Approval payload" payload={selectedApproval} />
              </>
            ) : (
              <p className="deckgo-note">Choose a pending approval to inspect it.</p>
            )}
            {policy ? <JsonDetails title="Policy payload" payload={policy} /> : null}
            {actionResult ? (
              <JsonDetails title="Last approval action" payload={actionResult} />
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
