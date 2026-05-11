import type { ChannelInventoryItem } from "../types";
import { WecomAccessControls, type WecomAccessAccount } from "../WecomAccessControls";

export function TabWeComAccess(props: {
  channel: ChannelInventoryItem;
  accessAccounts: WecomAccessAccount[];
  initialAccountId: string;
  initialFocus?: "access";
  onSaved: () => Promise<void> | void;
}) {
  const { channel, accessAccounts, initialAccountId, initialFocus, onSaved } = props;
  return (
    <section className="section">
      <WecomAccessControls
        channelId={channel.id}
        accounts={accessAccounts}
        defaultAccountId={channel.defaultAccountId}
        initialAccountId={initialAccountId}
        initialFocus={initialFocus}
        onSaved={onSaved}
      />
    </section>
  );
}
