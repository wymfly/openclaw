"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useChannelsStore } from "@/stores/channels";
import { ChannelDetail } from "./ChannelDetail";
import { ChannelList } from "./ChannelList";

/**
 * Channels panel -- entry point component.
 * Composes channel list sidebar (30%) and channel detail view (70%).
 */
export function ChannelsPanel() {
  const t = useTranslations("channels");
  const { selectedId, fetchChannels } = useChannelsStore();

  useEffect(() => {
    void fetchChannels();
  }, [fetchChannels]);

  return (
    <div
      className="flex h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      <ChannelList />
      <div className="flex flex-col flex-1 min-w-0">
        {selectedId ? (
          <ChannelDetail channelId={selectedId} />
        ) : (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--text-secondary)" }}
          >
            <p className="text-sm">{t("noChannels")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
