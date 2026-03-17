"use client";

import { HeartPulse, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useGatewayStore } from "@/stores/gateway";

export function HeartbeatCard() {
  const t = useTranslations("gateway");
  const tc = useTranslations("common");
  const { statusSummary, statusLoading, fetchStatus } = useGatewayStore();

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const heartbeat = statusSummary?.heartbeat;
  const state = statusSummary?.state;

  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-3"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
    >
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {t("heartbeat")}
      </h3>

      {statusLoading && !statusSummary ? (
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {tc("loading")}
        </span>
      ) : (
        <>
          {/* Last heartbeat */}
          <div className="flex items-center gap-2">
            <Clock size={14} style={{ color: "var(--accent)" }} />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {t("lastHeartbeat")}
            </span>
            <span className="text-xs font-mono ml-auto" style={{ color: "var(--text-primary)" }}>
              {heartbeat ?? "—"}
            </span>
          </div>

          {/* Gateway state */}
          <div className="flex items-center gap-2">
            <HeartPulse size={14} style={{ color: state === "active" ? "#22c55e" : "#eab308" }} />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {t("gatewayState")}
            </span>
            <span className="text-xs font-medium ml-auto" style={{ color: "var(--text-primary)" }}>
              {state ? t(state) : "—"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
