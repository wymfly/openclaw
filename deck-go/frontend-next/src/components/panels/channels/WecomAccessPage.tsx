"use client";

import type { ChannelInfo } from "@/stores/channels";
import { ChannelAccessTab } from "./ChannelAccessTab";

export function WecomAccessPage({
  channelId,
  channel,
  selectedAccountId,
  onSelectedAccountChange,
  onActivateAccessTab,
}: {
  channelId: string;
  channel: ChannelInfo;
  selectedAccountId?: string;
  onSelectedAccountChange?: (accountId: string) => void;
  onActivateAccessTab?: () => void;
}) {
  return (
    <ChannelAccessTab
      channelId={channelId}
      channel={channel}
      selectedAccountId={selectedAccountId}
      onSelectedAccountChange={onSelectedAccountChange}
      onActivateAccessTab={onActivateAccessTab}
    />
  );
}
