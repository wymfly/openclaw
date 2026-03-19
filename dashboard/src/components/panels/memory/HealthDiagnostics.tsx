"use client";

import { HeartPulse } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useMemoryStore } from "@/stores/memory";

const STATUS_BADGE_STYLES: Record<string, string> = {
  ok: "bg-[var(--success-muted)] text-[var(--success)]",
  error: "bg-[var(--danger-muted)] text-[var(--danger-muted-text)]",
  unknown: "bg-[var(--neutral-muted)] text-[var(--neutral-muted-text)]",
};

export function HealthDiagnostics() {
  const t = useTranslations("memory");
  const { healthStatus, isLanceDbEnabled, loading } = useMemoryStore();

  return (
    <ScrollArea className="p-4 h-full">
      {/* LanceDB status */}
      <div className="flex items-center gap-2 mb-4">
        <HeartPulse size={14} className="text-[var(--text-secondary)]" />
        <Badge
          className={cn(
            "text-xs h-auto py-1",
            isLanceDbEnabled
              ? "bg-[var(--success-muted)] text-[var(--success)]"
              : "bg-[var(--warning-muted)] text-[var(--warning-muted-text)]",
          )}
        >
          {isLanceDbEnabled ? t("lancedbEnabled") : t("lancedbDisabled")}
        </Badge>
      </div>

      {/* Health table */}
      {loading && healthStatus.length === 0 ? (
        <div className="text-[var(--text-secondary)]">
          <p className="text-sm animate-pulse">...</p>
        </div>
      ) : healthStatus.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-[var(--text-secondary)]">
          <HeartPulse size={18} className="text-[var(--accent)]" />
          <p className="text-sm">{t("noFiles")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-[var(--border)]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2.5 px-4 text-xs font-medium text-[var(--text-secondary)]">
                  {t("agent")}
                </th>
                <th className="text-left py-2.5 px-4 text-xs font-medium text-[var(--text-secondary)]">
                  Provider
                </th>
                <th className="text-left py-2.5 px-4 text-xs font-medium text-[var(--text-secondary)]">
                  Status
                </th>
                <th className="text-left py-2.5 px-4 text-xs font-medium text-[var(--text-secondary)]">
                  Error
                </th>
              </tr>
            </thead>
            <tbody>
              {healthStatus.map((entry) => (
                <tr
                  key={entry.agentId}
                  className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-tertiary)] transition-colors duration-150"
                >
                  <td className="py-2.5 px-4 font-mono text-[var(--text-primary)]">
                    {entry.agentId}
                  </td>
                  <td className="py-2.5 px-4 text-[var(--text-primary)]">{entry.provider}</td>
                  <td className="py-2.5 px-4">
                    <Badge
                      className={cn(
                        "uppercase font-semibold text-[10px] h-auto py-0.5",
                        STATUS_BADGE_STYLES[entry.embeddingStatus] ?? STATUS_BADGE_STYLES.unknown,
                      )}
                    >
                      {entry.embeddingStatus}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-4 text-[var(--text-secondary)]">
                    {entry.error ?? "---"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ScrollArea>
  );
}
