"use client";

import { Radio } from "lucide-react";
import { useTranslations } from "next-intl";
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

  return "var(--text-secondary)";
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
    <aside
      className="flex flex-col w-56 shrink-0 border-r h-full"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 text-xs font-semibold border-b"
        style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
      >
        {t("title")}
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto">
        {loading && channelOrder.length === 0 && (
          <div className="p-3 text-xs" style={{ color: "var(--text-secondary)" }}>
            {tc("loading")}
          </div>
        )}
        {!loading && channelOrder.length === 0 && (
          <div className="p-3 text-xs" style={{ color: "var(--text-secondary)" }}>
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
                  ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                  : "transparent",
                color: isActive ? "var(--accent)" : "var(--text-primary)",
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
                    <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                      {statusText}
                    </span>
                  </div>
                </div>
              </div>
              {channel.accounts.length > 1 && (
                <span
                  className="text-[10px] shrink-0 ml-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {channel.accounts.length} {t("accounts")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
