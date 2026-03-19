"use client";

import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
        <h3 className="text-sm font-medium text-[var(--text-primary)]">{t("deliveries")}</h3>
        <Button size="sm" variant="outline" onClick={onTest} disabled={testing} className="gap-1.5">
          <Send size={14} />
          {testing ? "..." : t("testDelivery")}
        </Button>
      </div>

      {deliveries.length === 0 ? (
        <p className="text-xs py-4 text-center text-[var(--text-secondary)]">{t("noDeliveries")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg ring-1 ring-[var(--border-subtle)]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-tertiary)]">
                <th className="text-left py-2.5 px-3 font-medium text-[var(--text-secondary)]">
                  {t("time")}
                </th>
                <th className="text-left py-2.5 px-3 font-medium text-[var(--text-secondary)]">
                  {t("eventType")}
                </th>
                <th className="text-left py-2.5 px-3 font-medium text-[var(--text-secondary)]">
                  {t("statusCode")}
                </th>
                <th className="text-left py-2.5 px-3 font-medium text-[var(--text-secondary)]">
                  {t("responseTime")}
                </th>
                <th className="text-left py-2.5 px-3 font-medium text-[var(--text-secondary)]">
                  {t("status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-[var(--border-subtle)] transition-colors duration-150 hover:bg-[var(--bg-tertiary)]"
                >
                  <td className="py-2.5 px-3 font-mono text-[var(--text-secondary)]">
                    {new Date(d.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-[var(--text-primary)]">{d.eventType}</td>
                  <td className="py-2.5 px-3 font-mono text-[var(--text-primary)]">
                    {d.statusCode ?? "—"}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[var(--text-secondary)]">
                    {d.durationMs != null ? `${d.durationMs}ms` : "—"}
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] h-4",
                        d.success
                          ? "bg-[var(--success-muted)] text-[var(--success-muted-text)]"
                          : "bg-[var(--danger-muted)] text-[var(--danger-muted-text)]",
                      )}
                    >
                      {d.success ? t("success") : t("failed")}
                    </Badge>
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
