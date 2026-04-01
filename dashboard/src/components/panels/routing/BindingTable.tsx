"use client";

import { Plus, Trash2, Filter } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AgentBadge } from "@/components/shared/AgentBadge";
import { BindingDialog } from "@/components/shared/BindingDialog";
import { TierBadge } from "@/components/shared/TierBadge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { navigateToChannel } from "@/lib/panel-navigation";
import { cn } from "@/lib/utils";
import { useAgentsStore } from "@/stores/agents";
import { useChannelsStore } from "@/stores/channels";
import { useDeckRoutingStore, type Binding, type BindingMatch } from "@/stores/deck-routing";

// Tier priority: lower index = higher priority
const TIER_ORDER = [
  "peer",
  "peer.parent",
  "guild+roles",
  "guild",
  "team",
  "account",
  "channel",
  "default",
];

function tierIndex(tier: string): number {
  const idx = TIER_ORDER.indexOf(tier);
  return idx === -1 ? TIER_ORDER.length : idx;
}

/** Summarize match conditions into a readable string. */
function summarizeMatch(match: Binding["match"]): string {
  const parts: string[] = [];
  if (match.channel) {
    parts.push(match.channel);
  }
  if (match.accountId) {
    parts.push(`acct:${match.accountId}`);
  }
  if (match.peer) {
    parts.push(`${match.peer.kind}:${match.peer.id}`);
  }
  if (match.guild) {
    parts.push(`guild:${match.guild}`);
  }
  if (match.roles?.length) {
    parts.push(`roles:${match.roles.join(",")}`);
  }
  if (match.team) {
    parts.push(`team:${match.team}`);
  }
  return parts.join(" · ") || "—";
}

export function BindingTable() {
  const { bindings, configHash, dmScope, loading, fetchBindings, addBinding, removeBinding } =
    useDeckRoutingStore();
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);
  const agents = useAgentsStore((s) => s.agents);
  const fetchChannels = useChannelsStore((s) => s.fetchChannels);
  const channelOrder = useChannelsStore((s) => s.channelOrder);

  const [channelFilter, setChannelFilter] = useState("__all__");
  const [agentFilter, setAgentFilter] = useState("__all__");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void fetchBindings();
    void fetchAgents();
    void fetchChannels();
  }, [fetchBindings, fetchAgents, fetchChannels]);

  // Sort by tier priority, filter by channel/agent
  const sorted = useMemo(() => {
    let list = [...bindings];
    if (channelFilter !== "__all__") {
      list = list.filter((b) => b.match.channel === channelFilter);
    }
    if (agentFilter !== "__all__") {
      list = list.filter((b) => b.agentId === agentFilter);
    }
    // Separate default from the rest
    const defaults = list.filter((b) => b.tier === "default");
    const rest = list.filter((b) => b.tier !== "default");
    rest.sort((a, b) => tierIndex(a.tier) - tierIndex(b.tier));
    return [...rest, ...defaults];
  }, [bindings, channelFilter, agentFilter]);

  const handleSave = async (match: BindingMatch, agentId: string) => {
    if (!configHash) {
      return;
    }
    await addBinding(match, agentId, configHash);
    setDialogOpen(false);
  };

  const handleDelete = async (bindingId: string) => {
    if (!configHash) {
      return;
    }
    setDeletingId(bindingId);
    await removeBinding(bindingId, configHash);
    setDeletingId(null);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header + filters */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Binding Rules</h3>
        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="h-7 gap-1.5 text-xs cursor-pointer"
        >
          <Plus size={14} />
          Add Rule
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-subtle)] shrink-0">
        <Filter size={13} className="text-[var(--muted-foreground)] shrink-0" />
        <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v ?? "__all__")}>
          <SelectTrigger className="h-7 w-[130px] text-xs bg-[var(--background)] border-[var(--border)] cursor-pointer">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Channels</SelectItem>
            {channelOrder.map((ch) => (
              <SelectItem key={ch} value={ch}>
                {ch}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={agentFilter} onValueChange={(v) => setAgentFilter(v ?? "__all__")}>
          <SelectTrigger className="h-7 w-[130px] text-xs bg-[var(--background)] border-[var(--border)] cursor-pointer">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Agents</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name || a.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-xs text-[var(--muted-foreground)]">
            <div
              className="animate-spin rounded-full h-5 w-5 border-2 border-current mr-2"
              style={{ borderTopColor: "transparent" }}
            />
            Loading...
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-[var(--muted-foreground)]">
            No binding rules found
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[var(--muted-foreground)]">
                <th className="text-left px-4 py-2 font-medium">Tier</th>
                <th className="text-left px-3 py-2 font-medium">Match Conditions</th>
                <th className="text-left px-3 py-2 font-medium">Agent</th>
                <th className="text-right px-4 py-2 font-medium w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((binding) => {
                const isDefault = binding.tier === "default";
                return (
                  <tr
                    key={binding.id}
                    className={cn(
                      "border-b border-[var(--border-subtle)] transition-colors",
                      isDefault ? "bg-[var(--background)]/50" : "hover:bg-[var(--muted)]/50",
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <TierBadge tier={binding.tier} />
                    </td>
                    <td className="px-3 py-2.5">
                      {binding.match.channel ? (
                        <button
                          type="button"
                          onClick={() => navigateToChannel(binding.match.channel)}
                          className="text-[var(--muted-foreground)] font-mono hover:text-[var(--primary)] transition-colors cursor-pointer"
                        >
                          {summarizeMatch(binding.match)}
                        </button>
                      ) : (
                        <span className="text-[var(--muted-foreground)] font-mono">
                          {summarizeMatch(binding.match)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <AgentBadge
                        agentId={binding.agentId}
                        agentName={binding.agentName}
                        emoji={binding.agentEmoji}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {!isDefault && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(binding.id)}
                          disabled={deletingId === binding.id}
                          className={cn(
                            "p-1 rounded-md transition-colors cursor-pointer",
                            "text-[var(--muted-foreground)] hover:text-red-400 hover:bg-red-500/10",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50",
                            "disabled:opacity-40 disabled:cursor-not-allowed",
                          )}
                          title="Delete binding"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* dmScope footer */}
      {dmScope && (
        <div className="px-4 py-2.5 border-t border-[var(--border-subtle)] shrink-0">
          <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
            DM Scope: <span className="text-[var(--foreground)]">{dmScope}</span>
          </span>
        </div>
      )}

      <BindingDialog
        open={dialogOpen}
        mode="add"
        onSave={(match, agentId) => void handleSave(match, agentId)}
        onCancel={() => setDialogOpen(false)}
      />
    </div>
  );
}
