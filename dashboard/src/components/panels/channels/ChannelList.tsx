"use client";

import { Radio } from "lucide-react";
import { useTranslations } from "next-intl";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useChannelsStore, type ChannelInfo } from "@/stores/channels";

type StatusStyle = { dot: string; text: string };

function getStatusStyle(channel: ChannelInfo): StatusStyle {
  const hasLinked = channel.accounts.some((a) => a.linked && a.connected);
  if (hasLinked) {
    return {
      dot: "bg-[var(--status-connected)]",
      text: "text-[var(--success-muted-text)]",
    };
  }

  const hasError = channel.accounts.some((a) => a.lastError);
  if (hasError) {
    return {
      dot: "bg-[var(--status-disconnected)]",
      text: "text-[var(--danger-muted-text)]",
    };
  }

  return {
    dot: "bg-[var(--text-secondary)]",
    text: "text-[var(--text-secondary)]",
  };
}

function getStatusLabel(channel: ChannelInfo, t: ReturnType<typeof useTranslations>): string {
  const hasLinked = channel.accounts.some((a) => a.linked && a.connected);
  if (hasLinked) {
    return t("linked");
  }

  const hasError = channel.accounts.some((a) => a.lastError);
  if (hasError) {
    return t("error");
  }

  const hasConfigured = channel.accounts.some((a) => a.configured);
  if (hasConfigured) {
    return t("configured");
  }

  return t("unconfigured");
}

export function ChannelList() {
  const t = useTranslations("channels");
  const tc = useTranslations("common");
  const { channels, channelOrder, selectedId, loading, selectChannel } = useChannelsStore();

  return (
    <aside className="flex flex-col w-56 shrink-0 border-r border-[var(--border)] h-full bg-[var(--bg-secondary)]">
      {/* Header */}
      <div className="flex items-center px-4 h-10 border-b border-[var(--border-subtle)]">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
          {t("title")}
        </span>
      </div>

      {/* Channel list */}
      <ScrollArea className="flex-1">
        <div className="px-2 py-1 space-y-0.5">
          {loading && channelOrder.length === 0 && (
            <div className="p-3 text-xs text-[var(--text-secondary)]">{tc("loading")}</div>
          )}
          {!loading && channelOrder.length === 0 && (
            <div className="p-3 text-xs text-[var(--text-secondary)]">{t("noChannels")}</div>
          )}
          {channelOrder.map((chId) => {
            const channel = channels.get(chId);
            if (!channel) {
              return null;
            }

            const isActive = selectedId === chId;
            const statusStyle = getStatusStyle(channel);
            const statusText = getStatusLabel(channel, t);

            return (
              <button
                key={chId}
                onClick={() => selectChannel(chId)}
                className={cn(
                  "relative flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs transition-colors duration-150 cursor-pointer group",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
                  isActive
                    ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
                )}
              >
                {/* Active indicator */}
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
                    aria-hidden
                  />
                )}

                <div className="flex items-center gap-2 min-w-0">
                  <Radio size={14} className="shrink-0" />
                  <div className="flex flex-col items-start min-w-0">
                    <span className="truncate w-full text-left font-medium">{channel.label}</span>
                    <div className="flex items-center gap-1">
                      <span
                        className={cn("inline-block w-1.5 h-1.5 rounded-full", statusStyle.dot)}
                      />
                      <span className="text-[10px] text-[var(--text-secondary)]">{statusText}</span>
                    </div>
                  </div>
                </div>
                {channel.accounts.length > 1 && (
                  <span className="text-[10px] shrink-0 ml-1 text-[var(--text-secondary)] font-mono">
                    {channel.accounts.length} {t("accounts")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}
