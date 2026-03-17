"use client";

import { Activity, Radio, Shield } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useGatewayStore } from "@/stores/gateway";

export function HealthCard() {
  const t = useTranslations("gateway");
  const tc = useTranslations("common");
  const { healthSummary, healthLoading, fetchHealth } = useGatewayStore();

  useEffect(() => {
    void fetchHealth();
  }, [fetchHealth]);

  const sessions = healthSummary?.sessions;
  const channels = healthSummary?.channels;
  const auth = healthSummary?.auth;

  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-3"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
    >
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {t("health")}
      </h3>

      {healthLoading && !healthSummary ? (
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {tc("loading")}
        </span>
      ) : (
        <>
          {/* Sessions */}
          <div className="flex items-center gap-2">
            <Activity size={14} style={{ color: "var(--accent)" }} />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {t("sessions")}
            </span>
            <span className="text-xs font-mono ml-auto" style={{ color: "var(--text-primary)" }}>
              {sessions ? `${sessions.active} / ${sessions.total}` : "—"}
            </span>
          </div>

          {/* Channels */}
          <div className="flex items-start gap-2">
            <Radio size={14} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {t("channels")}
              </span>
              {channels ? (
                Object.entries(channels).map(([name, status]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>
                      {name}
                    </span>
                    <span
                      className="text-xs ml-2 shrink-0"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {status}
                    </span>
                  </div>
                ))
              ) : (
                <span className="text-xs" style={{ color: "var(--text-primary)" }}>
                  —
                </span>
              )}
            </div>
          </div>

          {/* Auth */}
          <div className="flex items-center gap-2">
            <Shield size={14} style={{ color: "var(--accent)" }} />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Auth
            </span>
            <span className="text-xs ml-auto" style={{ color: "var(--text-primary)" }}>
              {auth ?? "—"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
