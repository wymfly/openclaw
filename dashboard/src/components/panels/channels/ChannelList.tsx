"use client";

import { Radio } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useChannelsStore, type ChannelInfo } from "@/stores/channels";

/**
 * Derive a status color from the channel's accounts.
 * - Any account linked && connected → green
 * - Any account with lastError → red
 * - Otherwise (unconfigured) → gray
 */
function getStatusColor(channel: ChannelInfo): string {
  const hasLinked = channel.accounts.some((a) => a.linked && a.connected);
  if (hasLinked) {
    return "var(--status-connected)";
  }

  const hasError = channel.accounts.some((a) => a.lastError);
  if (hasError) {
    return "var(--status-disconnected)";
  }

  return "var(--muted-foreground)";
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
  const { channels, channelOrder, selectedId, loading, selectChannel, channelSchemas } =
    useChannelsStore();

  // Channels discovered from schema but not yet in channelOrder (unconfigured)
  const discoveredOnlyIds = useMemo(
    () =>
      Array.from(channelSchemas.keys()).filter(
        (id) => !channelOrder.includes(id) && !channels.has(id),
      ),
    [channelSchemas, channelOrder, channels],
  );

  return (
    <aside
      className="flex flex-col w-56 shrink-0 border-r h-full"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 text-xs font-semibold border-b"
        style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
      >
        {t("title")}
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto">
        {loading && channelOrder.length === 0 && (
          <div className="p-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
            {tc("loading")}
          </div>
        )}
        {!loading && channelOrder.length === 0 && discoveredOnlyIds.length === 0 && (
          <div className="p-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t("noChannels")}
          </div>
        )}
        {channelOrder.map((chId) => {
          const channel = channels.get(chId);
          if (!channel) {
            return null;
          }

          const isActive = selectedId === chId;
          const statusColor = getStatusColor(channel);
          const statusText = getStatusLabel(channel, t);

          return (
            <button
              key={chId}
              onClick={() => selectChannel(chId)}
              className="flex items-center justify-between w-full px-3 py-2 text-xs transition-colors group"
              style={{
                backgroundColor: isActive
                  ? "color-mix(in srgb, var(--primary) 12%, transparent)"
                  : "transparent",
                color: isActive ? "var(--primary)" : "var(--foreground)",
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Radio size={14} className="shrink-0" />
                <div className="flex flex-col items-start min-w-0">
                  <span className="truncate w-full text-left">{channel.label}</span>
                  <div className="flex items-center gap-1">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: statusColor }}
                    />
                    <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                      {statusText}
                    </span>
                  </div>
                </div>
              </div>
              {channel.accounts.length > 1 && (
                <span
                  className="text-[10px] shrink-0 ml-1"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {channel.accounts.length} {t("accounts")}
                </span>
              )}
            </button>
          );
        })}

        {/* Channels discovered from schema but not yet configured */}
        {discoveredOnlyIds.map((chId) => {
          const isActive = selectedId === chId;
          return (
            <button
              key={chId}
              onClick={() => selectChannel(chId)}
              className="flex items-center justify-between w-full px-3 py-2 text-xs transition-colors group"
              style={{
                backgroundColor: isActive
                  ? "color-mix(in srgb, var(--primary) 12%, transparent)"
                  : "transparent",
                color: isActive ? "var(--primary)" : "var(--muted-foreground)",
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Radio size={14} className="shrink-0" />
                <div className="flex flex-col items-start min-w-0">
                  <span className="truncate w-full text-left">{chId}</span>
                  <div className="flex items-center gap-1">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: "var(--muted-foreground)" }}
                    />
                    <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                      {t("unconfigured")}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
