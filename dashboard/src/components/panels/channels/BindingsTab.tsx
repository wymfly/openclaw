"use client";

import { ExternalLink, Loader2, Plus, Shield, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { AgentBadge } from "@/components/shared/AgentBadge";
import { BindingDialog } from "@/components/shared/BindingDialog";
import { TierBadge } from "@/components/shared/TierBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { navigateToRouting } from "@/lib/panel-navigation";
import { cn } from "@/lib/utils";
import { useChannelsStore } from "@/stores/channels";
import { useDeckRoutingStore, type Binding, type BindingMatch } from "@/stores/deck-routing";

/**
 * Channel → Agent binding management tab.
 * Select a channel + account, view bound agents, add/remove bindings.
 */
export function BindingsTab() {
  const tc = useTranslations("common");

  const channelOrder = useChannelsStore((s) => s.channelOrder);
  const channelMap = useChannelsStore((s) => s.channels);

  const { bindings, configHash, dmScope, loading, fetchBindings, removeBinding } =
    useDeckRoutingStore();

  const [selectedChannel, setSelectedChannel] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Load bindings on mount
  useEffect(() => {
    void fetchBindings();
  }, [fetchBindings]);

  // Get accounts for selected channel
  const selectedChannelInfo = selectedChannel ? channelMap.get(selectedChannel) : undefined;
  const accounts = selectedChannelInfo?.accounts ?? [];

  // Filter bindings by selected channel + account (skip "__all__" sentinel)
  const filteredBindings = bindings.filter((b) => {
    if (selectedChannel && selectedChannel !== "__all__" && b.match.channel !== selectedChannel) {
      return false;
    }
    if (selectedAccount && selectedAccount !== "__all__" && b.match.accountId !== selectedAccount) {
      return false;
    }
    return true;
  });

  const handleRemoveConfirm = useCallback(async () => {
    if (!confirmingId) {
      return;
    }
    setRemoving(confirmingId);
    const id = confirmingId;
    setConfirmingId(null);
    await removeBinding(id, configHash ?? "");
    setRemoving(null);
  }, [confirmingId, configHash, removeBinding]);

  const handleAddSave = useCallback(async (match: BindingMatch, agentId: string) => {
    const { addBinding, fetchBindings: reload } = useDeckRoutingStore.getState();
    const hash = useDeckRoutingStore.getState().configHash ?? "";
    await addBinding(match, agentId, hash);
    await reload();
    setDialogOpen(false);
  }, []);

  // Count paired users from bindings (peer kind = direct/user)
  const pairedUserCount = bindings.filter(
    (b) => b.match.peer?.kind === "direct" || b.match.peer?.kind === "user",
  ).length;

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="px-4 py-3 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="space-y-1 flex-1">
            <Label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              Channel
            </Label>
            <Select
              value={selectedChannel}
              onValueChange={(v) => {
                setSelectedChannel(v ?? "");
                setSelectedAccount("");
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-[var(--bg-primary)] border-[var(--border)] cursor-pointer">
                <SelectValue placeholder="All channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All channels</SelectItem>
                {channelOrder.map((ch) => (
                  <SelectItem key={ch} value={ch}>
                    {channelMap.get(ch)?.label ?? ch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedChannel && selectedChannel !== "__all__" && accounts.length > 0 && (
            <div className="space-y-1 flex-1">
              <Label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                Account
              </Label>
              <Select value={selectedAccount} onValueChange={(v) => setSelectedAccount(v ?? "")}>
                <SelectTrigger className="h-8 text-xs bg-[var(--bg-primary)] border-[var(--border)] cursor-pointer">
                  <SelectValue placeholder="All accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All accounts</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.accountId} value={acc.accountId}>
                      {acc.name || acc.accountId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="pt-4 flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDialogOpen(true)}
              className="gap-1.5 cursor-pointer text-xs"
            >
              <Plus size={14} />
              Add Binding
            </Button>
            <button
              onClick={() => navigateToRouting()}
              className="flex items-center gap-1 text-[10px] text-[var(--accent)] hover:underline cursor-pointer"
            >
              View all routing rules
              <ExternalLink size={10} />
            </button>
          </div>
        </div>
      </div>

      {/* Bindings table */}
      <ScrollArea className="flex-1">
        {loading && (
          <div className="flex items-center justify-center py-12 text-[var(--text-secondary)]">
            <Loader2 size={16} className="animate-spin mr-2" />
            <span className="text-sm">{tc("loading")}</span>
          </div>
        )}

        {!loading && filteredBindings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-[var(--text-secondary)]">
            <p className="text-sm">No bindings found</p>
            <p className="text-xs">
              Use the &quot;Add Binding&quot; button to create a routing rule
            </p>
          </div>
        )}

        {!loading && filteredBindings.length > 0 && (
          <div className="p-4">
            <div className="rounded-lg border border-[var(--border)] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-tertiary)]">
                    <th className="text-left px-3 py-2 font-medium text-[var(--text-secondary)]">
                      Channel / Peer
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--text-secondary)]">
                      Target Agent
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--text-secondary)]">
                      Tier
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBindings.map((binding, idx) => (
                    <BindingRow
                      key={binding.id}
                      binding={binding}
                      isEven={idx % 2 === 1}
                      removing={removing === binding.id}
                      onRemove={() => setConfirmingId(binding.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DM policy summary */}
        {dmScope && (
          <div className="px-4 pb-4">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] p-3">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={14} className="text-[var(--accent)]" />
                <span className="text-xs font-medium text-[var(--text-primary)]">
                  DM Policy Summary
                </span>
              </div>
              <div className="space-y-1.5 text-[10px] text-[var(--text-secondary)]">
                <p>
                  <span className="font-medium text-[var(--text-primary)]">Merge mode:</span>{" "}
                  {dmScope}
                </p>
                <p>
                  <span className="font-medium text-[var(--text-primary)]">Paired users:</span>{" "}
                  {pairedUserCount}
                </p>
              </div>
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Unbind confirmation dialog */}
      <Dialog open={!!confirmingId} onOpenChange={(o) => !o && setConfirmingId(null)}>
        <DialogContent className="bg-[var(--bg-secondary)] border-[var(--border)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">确认解绑?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--text-secondary)]">此操作将移除该路由绑定，确认继续？</p>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmingId(null)}
              className="cursor-pointer"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleRemoveConfirm()}
              className="cursor-pointer"
            >
              确认解绑
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Binding dialog */}
      <BindingDialog
        open={dialogOpen}
        mode="add"
        prefill={{
          channel: selectedChannel && selectedChannel !== "__all__" ? selectedChannel : undefined,
          accountId: selectedAccount && selectedAccount !== "__all__" ? selectedAccount : undefined,
        }}
        onSave={(match, agentId) => void handleAddSave(match, agentId)}
        onCancel={() => setDialogOpen(false)}
      />
    </div>
  );
}

function BindingRow({
  binding,
  isEven,
  removing,
  onRemove,
}: {
  binding: Binding;
  isEven: boolean;
  removing: boolean;
  onRemove: () => void;
}) {
  const peerLabel = binding.match.peer
    ? `${binding.match.peer.kind}:${binding.match.peer.id}`
    : binding.match.channel;

  return (
    <tr
      className={cn(
        "border-b border-[var(--border)] last:border-b-0",
        isEven && "bg-[var(--bg-tertiary)]/50",
      )}
    >
      <td className="px-3 py-2">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[var(--text-primary)]">{peerLabel}</span>
          {binding.match.accountId && (
            <span className="text-[10px] text-[var(--text-secondary)]">
              account: {binding.match.accountId}
            </span>
          )}
          {binding.match.guildId && (
            <span className="text-[10px] text-[var(--text-secondary)]">
              guild: {binding.match.guildId}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <AgentBadge agentId={binding.agentId} />
      </td>
      <td className="px-3 py-2">
        <TierBadge tier={binding.tier} />
      </td>
      <td className="px-3 py-2 text-right">
        {removing ? (
          <Loader2 size={14} className="animate-spin ml-auto text-[var(--text-secondary)]" />
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            className="cursor-pointer ml-auto text-[var(--text-secondary)] hover:text-[var(--danger)]"
            title="Unbind"
          >
            <Trash2 size={13} />
          </Button>
        )}
      </td>
    </tr>
  );
}
