"use client";

import { useTranslations } from "next-intl";
import type { WebhookDelivery } from "@/stores/webhooks";

interface DeliveryHistoryProps {
  deliveries: WebhookDelivery[];
  onTest: () => void;
  testing?: boolean;
}

export function DeliveryHistory({ deliveries, onTest, testing }: DeliveryHistoryProps) {
  const t = useTranslations("webhooks");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {t("deliveries")}
        </h3>
        <button
          type="button"
          className="px-3 py-1 text-xs rounded-md font-medium transition-colors"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-fg)" }}
          onClick={onTest}
          disabled={testing}
        >
          {testing ? "..." : t("testDelivery")}
        </button>
      </div>

      {deliveries.length === 0 ? (
        <p className="text-xs py-4 text-center" style={{ color: "var(--text-secondary)" }}>
          {t("noDeliveries")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr
                className="border-b"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                <th className="text-left py-2 px-2 font-medium">{t("time")}</th>
                <th className="text-left py-2 px-2 font-medium">{t("eventType")}</th>
                <th className="text-left py-2 px-2 font-medium">{t("statusCode")}</th>
                <th className="text-left py-2 px-2 font-medium">{t("responseTime")}</th>
                <th className="text-left py-2 px-2 font-medium">{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                  <td className="py-2 px-2" style={{ color: "var(--text-secondary)" }}>
                    {new Date(d.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 px-2" style={{ color: "var(--text-primary)" }}>
                    {d.eventType}
                  </td>
                  <td className="py-2 px-2" style={{ color: "var(--text-primary)" }}>
                    {d.statusCode ?? "—"}
                  </td>
                  <td className="py-2 px-2" style={{ color: "var(--text-secondary)" }}>
                    {d.durationMs != null ? `${d.durationMs}ms` : "—"}
                  </td>
                  <td className="py-2 px-2">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: d.success ? "var(--success-muted)" : "var(--danger-muted)",
                        color: d.success ? "var(--success)" : "var(--danger)",
                      }}
                    >
                      {d.success ? t("success") : t("failed")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
