"use client";

import { Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useChannelsStore } from "@/stores/channels";
import { ChannelDetail } from "./ChannelDetail";
import { ChannelList } from "./ChannelList";

/**
 * Channels panel — entry point component.
 * Master-detail: channel list sidebar + channel detail view.
 */
export function ChannelsPanel() {
  const t = useTranslations("channels");
  const { selectedId, fetchChannels } = useChannelsStore();

  useEffect(() => {
    void fetchChannels();
  }, [fetchChannels]);

  return (
    <div className="flex h-full overflow-hidden rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)]">
      <ChannelList />
      <div className="flex flex-col flex-1 min-w-0">
        {selectedId ? (
          <ChannelDetail channelId={selectedId} />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 h-full text-[var(--text-secondary)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-tertiary)] ring-1 ring-[var(--border-subtle)]">
              <Share2 size={20} className="text-[var(--accent)]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--text-primary)]">{t("noChannels")}</p>
              <p className="text-xs mt-0.5">{t("title")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
