"use client";

import { useTranslations } from "next-intl";
import { useMemoryStore } from "@/stores/memory";

// ---------------------------------------------------------------------------
// Status colors
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ok: {
    bg: "var(--success-muted)",
    text: "var(--success)",
  },
  error: {
    bg: "var(--danger-muted)",
    text: "var(--danger)",
  },
  unknown: {
    bg: "var(--bg-tertiary)",
    text: "var(--text-secondary)",
  },
};

/**
 * HealthDiagnostics — table showing agent memory health status.
 * Columns: Agent ID, Provider, Embedding Status, Error details.
 */
export function HealthDiagnostics() {
  const t = useTranslations("memory");
  const { healthStatus, isLanceDbEnabled, loading } = useMemoryStore();

  return (
    <div className="p-4 overflow-y-auto h-full">
      {/* LanceDB status */}
      <div
        className="text-xs mb-4 px-3 py-2 rounded inline-block"
        style={{
          backgroundColor: isLanceDbEnabled ? "var(--success-muted)" : "var(--warning-muted)",
          color: isLanceDbEnabled ? "var(--success)" : "var(--warning)",
        }}
      >
        {isLanceDbEnabled ? t("lancedbEnabled") : t("lancedbDisabled")}
      </div>

      {/* Health table */}
      {loading && healthStatus.length === 0 ? (
        <div style={{ color: "var(--text-secondary)" }}>
          <p className="text-sm">...</p>
        </div>
      ) : healthStatus.length === 0 ? (
        <div style={{ color: "var(--text-secondary)" }}>
          <p className="text-sm">{t("noFiles")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ color: "var(--text-primary)" }}>
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <th
                  className="text-left py-2 px-3 font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t("agent")}
                </th>
                <th
                  className="text-left py-2 px-3 font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Provider
                </th>
                <th
                  className="text-left py-2 px-3 font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Status
                </th>
                <th
                  className="text-left py-2 px-3 font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Error
                </th>
              </tr>
            </thead>
            <tbody>
              {healthStatus.map((entry) => {
                const colors = STATUS_COLORS[entry.embeddingStatus] ?? STATUS_COLORS.unknown;
                return (
                  <tr
                    key={entry.agentId}
                    className="border-b"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="py-2 px-3 font-mono">{entry.agentId}</td>
                    <td className="py-2 px-3">{entry.provider}</td>
                    <td className="py-2 px-3">
                      <span
                        className="px-2 py-0.5 rounded uppercase font-semibold"
                        style={{
                          backgroundColor: colors.bg,
                          color: colors.text,
                          fontSize: 10,
                        }}
                      >
                        {entry.embeddingStatus}
                      </span>
                    </td>
                    <td className="py-2 px-3" style={{ color: "var(--text-secondary)" }}>
                      {entry.error ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
