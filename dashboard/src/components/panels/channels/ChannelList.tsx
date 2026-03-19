"use client";

import { Radio } from "lucide-react";
import { useTranslations } from "next-intl";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useChannelsStore, type ChannelInfo } from "@/stores/channels";

/**
 * Derive a status color class from the channel's accounts.
 * - Any account linked && connected → success (green)
 * - Any account with lastError → destructive (red)
 * - Otherwise (unconfigured) → muted (gray)
 */
type StatusStyle = { dot: string; text: string };

function getStatusStyle(channel: ChannelInfo): StatusStyle {
  const hasLinked = channel.accounts.some((a) => a.linked && a.connected);
  if (hasLinked) {
    return {
      dot: "bg-[var(--status-connected)]",
      text: "text-[var(--status-connected)]",
    };
  }

  const hasError = channel.accounts.some((a) => a.lastError);
  if (hasError) {
    return {
      dot: "bg-[var(--status-disconnected)]",
      text: "text-[var(--status-disconnected)]",
    };
  }

  return {
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
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
    <aside className="flex flex-col w-56 shrink-0 border-r border-border h-full bg-card">
      {/* Header */}
      <div className="px-3 py-2 text-xs font-semibold border-b border-border text-foreground">
        {t("title")}
      </div>

      {/* Channel list */}
      <ScrollArea className="flex-1">
        {loading && channelOrder.length === 0 && (
          <div className="p-3 text-xs text-muted-foreground">{tc("loading")}</div>
        )}
        {!loading && channelOrder.length === 0 && (
          <div className="p-3 text-xs text-muted-foreground">{t("noChannels")}</div>
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
                "flex items-center justify-between w-full px-3 py-2 text-xs transition-colors group",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "bg-transparent text-foreground hover:bg-muted",
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Radio size={14} className="shrink-0" />
                <div className="flex flex-col items-start min-w-0">
                  <span className="truncate w-full text-left">{channel.label}</span>
                  <div className="flex items-center gap-1">
                    <span
                      className={cn("inline-block w-1.5 h-1.5 rounded-full", statusStyle.dot)}
                    />
                    <span className="text-[10px] text-muted-foreground">{statusText}</span>
                  </div>
                </div>
              </div>
              {channel.accounts.length > 1 && (
                <span className="text-[10px] shrink-0 ml-1 text-muted-foreground">
                  {channel.accounts.length} {t("accounts")}
                </span>
              )}
            </button>
          );
        })}
      </ScrollArea>
    </aside>
  );
}
