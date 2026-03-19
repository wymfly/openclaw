"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useMemoryStore } from "@/stores/memory";

const STATUS_BADGE_STYLES: Record<string, string> = {
  ok: "bg-[var(--success-muted)] text-[var(--success)]",
  error: "bg-[var(--danger-muted)] text-[var(--danger)]",
  unknown: "bg-muted text-muted-foreground",
};

export function HealthDiagnostics() {
  const t = useTranslations("memory");
  const { healthStatus, isLanceDbEnabled, loading } = useMemoryStore();

  return (
    <ScrollArea className="p-4 h-full">
      {/* LanceDB status */}
      <Badge
        className={cn(
          "mb-4 text-xs h-auto py-1",
          isLanceDbEnabled
            ? "bg-[var(--success-muted)] text-[var(--success)]"
            : "bg-[var(--warning-muted)] text-[var(--warning)]",
        )}
      >
        {isLanceDbEnabled ? t("lancedbEnabled") : t("lancedbDisabled")}
      </Badge>

      {/* Health table */}
      {loading && healthStatus.length === 0 ? (
        <div className="text-muted-foreground">
          <p className="text-sm">...</p>
        </div>
      ) : healthStatus.length === 0 ? (
        <div className="text-muted-foreground">
          <p className="text-sm">{t("noFiles")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-foreground">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                  {t("agent")}
                </th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Provider</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Error</th>
              </tr>
            </thead>
            <tbody>
              {healthStatus.map((entry) => (
                <tr key={entry.agentId} className="border-b border-border">
                  <td className="py-2 px-3 font-mono">{entry.agentId}</td>
                  <td className="py-2 px-3">{entry.provider}</td>
                  <td className="py-2 px-3">
                    <Badge
                      className={cn(
                        "uppercase font-semibold text-[10px] h-auto py-0.5",
                        STATUS_BADGE_STYLES[entry.embeddingStatus] ?? STATUS_BADGE_STYLES.unknown,
                      )}
                    >
                      {entry.embeddingStatus}
                    </Badge>
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">{entry.error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ScrollArea>
  );
}
