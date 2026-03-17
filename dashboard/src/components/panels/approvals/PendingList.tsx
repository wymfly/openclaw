"use client";

import { useTranslations } from "next-intl";
import { useApprovalsStore, type ApprovalDecision } from "@/stores/approvals";

/**
 * PendingList — shows pending approvals with resolve actions.
 *
 * Each item displays: command, agent, timestamp.
 * Three action buttons: Approve (allow-once), Always Approve (allow-always), Deny.
 */
export function PendingList() {
  const t = useTranslations("approvals");
  const pending = useApprovalsStore((s) => s.pending);
  const resolveApproval = useApprovalsStore((s) => s.resolveApproval);

  const handleResolve = (id: string, decision: ApprovalDecision) => {
    void resolveApproval(id, decision);
  };

  if (pending.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {t("noPending")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {pending.map((item) => (
        <div
          key={item.id}
          className="rounded-lg border p-3"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--bg-secondary)",
          }}
        >
          {/* Command + details */}
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-xs font-medium px-2 py-0.5 rounded"
                style={{
                  backgroundColor: "rgba(234, 179, 8, 0.15)",
                  color: "#eab308",
                }}
              >
                {t("command")}
              </span>
              <code className="text-sm font-mono truncate" style={{ color: "var(--text-primary)" }}>
                {item.command}
              </code>
            </div>

            <div
              className="flex items-center gap-4 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              {item.agentId && (
                <span>
                  {t("agent")}: {item.agentId}
                </span>
              )}
              <span>
                {t("requestedAt")}: {new Date(item.createdAtMs).toLocaleTimeString()}
              </span>
              <span>
                {t("expiresAt")}: {new Date(item.expiresAtMs).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleResolve(item.id, "allow-once")}
              className="text-xs px-3 py-1 rounded border cursor-pointer"
              style={{
                borderColor: "var(--status-connected)",
                color: "var(--status-connected)",
                backgroundColor: "transparent",
              }}
            >
              {t("approve")}
            </button>
            <button
              onClick={() => handleResolve(item.id, "allow-always")}
              className="text-xs px-3 py-1 rounded border cursor-pointer"
              style={{
                borderColor: "var(--accent)",
                color: "var(--accent)",
                backgroundColor: "transparent",
              }}
            >
              {t("approveAlways")}
            </button>
            <button
              onClick={() => handleResolve(item.id, "deny")}
              className="text-xs px-3 py-1 rounded border cursor-pointer"
              style={{
                borderColor: "var(--status-disconnected)",
                color: "var(--status-disconnected)",
                backgroundColor: "transparent",
              }}
            >
              {t("deny")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
