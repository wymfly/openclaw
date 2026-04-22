"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useNodesStore, type PairingRequest } from "@/stores/nodes";
import { useNotificationsStore } from "@/stores/notifications";

interface PairingRequestCardProps {
  request: PairingRequest;
}

export function PairingRequestCard({ request }: PairingRequestCardProps) {
  const t = useTranslations("nodes");
  const tc = useTranslations("common");
  const approvePairing = useNodesStore((s) => s.approvePairing);
  const rejectPairing = useNodesStore((s) => s.rejectPairing);
  const { addToast } = useNotificationsStore();
  const [loadingAction, setLoadingAction] = useState<"approve" | "reject" | null>(null);

  const handleAction = async (action: "approve" | "reject") => {
    setLoadingAction(action);
    try {
      const ok =
        action === "approve"
          ? await approvePairing(request.requestId)
          : await rejectPairing(request.requestId);
      if (!ok) {
        addToast("error", t("pairingActionFailed"), 3000);
        return;
      }
      addToast("success", action === "approve" ? t("pairingApproved") : t("pairingRejected"), 3000);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="px-3 py-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>
            {request.displayName ?? request.nodeId}
          </p>
          {request.platform && (
            <p className="text-[10px] text-[var(--muted-foreground)]">{request.platform}</p>
          )}
          {request.isRepair && (
            <span
              className="text-[9px] px-1 py-0.5 rounded"
              style={{
                backgroundColor: "var(--warning-muted)",
                color: "var(--warning-muted-text)",
              }}
            >
              {t("repair")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={loadingAction !== null}
            onClick={() => void handleAction("approve")}
            className="p-1.5 rounded-md transition-colors hover:bg-[var(--success-muted)]"
            title={t("approve")}
          >
            {loadingAction === "approve" ? (
              <span className="text-[10px] text-[var(--muted-foreground)]">{tc("loading")}</span>
            ) : (
              <Check size={14} className="text-[var(--success)]" />
            )}
          </button>
          <button
            type="button"
            disabled={loadingAction !== null}
            onClick={() => void handleAction("reject")}
            className="p-1.5 rounded-md transition-colors hover:bg-[var(--destructive-muted)]"
            title={t("reject")}
          >
            {loadingAction === "reject" ? (
              <span className="text-[10px] text-[var(--muted-foreground)]">{tc("loading")}</span>
            ) : (
              <X size={14} className="text-[var(--destructive)]" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
