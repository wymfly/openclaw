"use client";

import type { ChannelInfo } from "../../../stores/channels";
import { AccessPanel } from "./access-descriptors/AccessPanel";

export function ChannelAccessTab({
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
    <AccessPanel
      channelId={channelId}
      channel={channel}
      slot="access-tab"
      selectedAccountId={selectedAccountId}
      onSelectedAccountChange={onSelectedAccountChange}
      onActivateAccessTab={onActivateAccessTab}
    />
  );
}
