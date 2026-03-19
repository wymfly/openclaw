"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
        <h3 className="text-sm font-medium text-foreground">{t("deliveries")}</h3>
        <Button size="sm" onClick={onTest} disabled={testing}>
          {testing ? "..." : t("testDelivery")}
        </Button>
      </div>

      {deliveries.length === 0 ? (
        <p className="text-xs py-4 text-center text-muted-foreground">{t("noDeliveries")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 px-2 font-medium">{t("time")}</th>
                <th className="text-left py-2 px-2 font-medium">{t("eventType")}</th>
                <th className="text-left py-2 px-2 font-medium">{t("statusCode")}</th>
                <th className="text-left py-2 px-2 font-medium">{t("responseTime")}</th>
                <th className="text-left py-2 px-2 font-medium">{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id} className="border-b border-border">
                  <td className="py-2 px-2 text-muted-foreground">
                    {new Date(d.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 px-2 text-foreground">{d.eventType}</td>
                  <td className="py-2 px-2 text-foreground">{d.statusCode ?? "—"}</td>
                  <td className="py-2 px-2 text-muted-foreground">
                    {d.durationMs != null ? `${d.durationMs}ms` : "—"}
                  </td>
                  <td className="py-2 px-2">
                    <Badge variant={d.success ? "default" : "destructive"} className="text-xs">
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
