"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { AuthOverviewEntry } from "@/stores/models";
import { AuthStatusDot } from "../shared/AuthStatusDot";

interface ProviderSidebarProps {
  auth: AuthOverviewEntry[];
  selected: string | null;
  onSelect: (provider: string) => void;
}

/** Human-readable label for auth type. */
function authTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case "api_key":
      return "API Key";
    case "oauth":
      return "OAuth";
    case "token":
      return "Token";
    case "aws-sdk":
      return "AWS SDK";
    default:
      return "\u2014";
  }
}

/**
 * Left-pane provider sidebar for the Config tab.
 * Groups providers into "Configured" (ready/warning) and "Unconfigured" (missing/unknown).
 */
export function ProviderSidebar({ auth, selected, onSelect }: ProviderSidebarProps) {
  const t = useTranslations("models");

  const configured = auth.filter((e) => e.status !== "missing" && e.status !== "unknown");
  const unconfigured = auth.filter((e) => e.status === "missing" || e.status === "unknown");

  const renderRow = (entry: AuthOverviewEntry) => {
    const isSelected = selected === entry.provider;

    return (
      <button
        key={entry.provider}
        type="button"
        onClick={() => onSelect(entry.provider)}
        className={cn(
          "relative flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-all duration-150",
          "hover:bg-[var(--bg-tertiary)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
          isSelected && [
            "bg-[var(--accent-muted)]",
            "shadow-[inset_0_0_0_1px_var(--accent),var(--accent-glow)]",
          ],
        )}
      >
        {/* Active accent bar */}
        {isSelected && (
          <span
            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
            aria-hidden
          />
        )}

        <AuthStatusDot status={entry.status} size="sm" />

        <span
          className={cn(
            "truncate font-medium uppercase tracking-[0.04em]",
            isSelected ? "text-[var(--accent)]" : "text-[var(--text-primary)]",
          )}
        >
          {entry.provider}
        </span>

        {/* Auth type badge */}
        {entry.auth?.type && (
          <Badge
            variant="outline"
            className="ml-auto shrink-0 px-1.5 py-0 text-[10px] leading-tight h-4"
          >
            {authTypeLabel(entry.auth.type)}
          </Badge>
        )}
      </button>
    );
  };

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-secondary)]">
      <ScrollArea className="flex-1">
        <div className="py-2 space-y-1">
          {/* Configured section */}
          {configured.length > 0 && (
            <div>
              <h3 className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("config.configured")}
              </h3>
              <div className="space-y-0.5 px-2">{configured.map(renderRow)}</div>
            </div>
          )}

          {/* Unconfigured section */}
          {unconfigured.length > 0 && (
            <div>
              <h3 className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("config.unconfigured")}
              </h3>
              <div className="space-y-0.5 px-2">{unconfigured.map(renderRow)}</div>
            </div>
          )}

          {/* Empty state */}
          {auth.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-[var(--text-secondary)]">
              {t("selectProvider")}
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
