"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2, Filter } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { ConflictBadge } from "./ConflictBadge";

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
  if (match.guildId) {
    parts.push(`guild:${match.guildId}`);
  }
  if (match.roles?.length) {
    parts.push(`roles:${match.roles.join(",")}`);
  }
  if (match.teamId) {
    parts.push(`team:${match.teamId}`);
  }
  return parts.join(" · ") || "—";
}

// ---------------------------------------------------------------------------
// SortableRow
// ---------------------------------------------------------------------------

interface SortableRowProps {
  binding: Binding;
  isDefault: boolean;
  deletingId: string | null;
  conflicts: Array<{ bindingId: string; overlapType: string }>;
  onDelete: (id: string) => void;
}

function SortableRow({ binding, isDefault, deletingId, conflicts, onDelete }: SortableRowProps) {
  const t = useTranslations("routing");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: binding.id,
    data: { tier: binding.tier },
    disabled: isDefault,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "border-b border-[var(--border-subtle)] transition-colors",
        isDefault ? "bg-[var(--bg-primary)]/50" : "hover:bg-[var(--bg-tertiary)]/50",
      )}
    >
      {/* Drag handle */}
      <td className="w-8 px-1 py-2.5">
        {!isDefault && (
          <span
            {...listeners}
            className="flex items-center justify-center cursor-grab text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title={t("dragHandle")}
          >
            <GripVertical size={14} />
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <TierBadge tier={binding.tier} />
          {conflicts.length > 0 && <ConflictBadge conflicts={conflicts} />}
        </div>
      </td>
      <td className="px-3 py-2.5">
        {binding.match.channel ? (
          <button
            type="button"
            onClick={() => navigateToChannel(binding.match.channel)}
            className="text-[var(--text-secondary)] font-mono hover:text-[var(--accent)] transition-colors cursor-pointer"
          >
            {summarizeMatch(binding.match)}
          </button>
        ) : (
          <span className="text-[var(--text-secondary)] font-mono">
            {summarizeMatch(binding.match)}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <AgentBadge agentId={binding.agentId} />
      </td>
      <td className="px-4 py-2.5 text-right">
        {!isDefault && (
          <button
            type="button"
            onClick={() => onDelete(binding.id)}
            disabled={deletingId === binding.id}
            className={cn(
              "p-1 rounded-md transition-colors cursor-pointer",
              "text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
            title={t("deleteBinding")}
          >
            <Trash2 size={14} />
          </button>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// BindingTable
// ---------------------------------------------------------------------------

export function BindingTable() {
  const t = useTranslations("routing");
  const tc = useTranslations("common");
  const {
    bindings,
    configHash,
    dmScope,
    loading,
    conflictPairs,
    fetchBindings,
    addBinding,
    removeBinding,
    reorderBinding,
  } = useDeckRoutingStore();
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

  // Conflict lookup: bindingId → array of conflicting counterparts
  const conflictMap = useMemo(() => {
    const map = new Map<string, Array<{ bindingId: string; overlapType: string }>>();
    for (const pair of conflictPairs) {
      if (!map.has(pair.bindingA)) {
        map.set(pair.bindingA, []);
      }
      map.get(pair.bindingA)!.push({ bindingId: pair.bindingB, overlapType: pair.overlapType });
      if (!map.has(pair.bindingB)) {
        map.set(pair.bindingB, []);
      }
      map.get(pair.bindingB)!.push({ bindingId: pair.bindingA, overlapType: pair.overlapType });
    }
    return map;
  }, [conflictPairs]);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !configHash) {
      return;
    }

    const activeTier = active.data.current?.tier as string | undefined;
    const overTier = over.data.current?.tier as string | undefined;
    if (activeTier !== overTier) {
      return;
    } // cross-tier blocked

    const oldIndex = sorted.findIndex((b) => b.id === active.id);
    const newIndex = sorted.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Map sorted index to global bindings position (F2 fix)
    const targetBinding = sorted[newIndex];
    const globalPosition = bindings.findIndex((b) => b.id === targetBinding.id);

    const movedBinding = sorted[oldIndex];
    // Use atomic reorderBinding to avoid configHash mismatch (F1 fix)
    void reorderBinding(movedBinding, globalPosition >= 0 ? globalPosition : newIndex, configHash);
  };

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
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t("bindings")}</h3>
        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="h-7 gap-1.5 text-xs cursor-pointer"
        >
          <Plus size={14} />
          {t("addBinding")}
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-subtle)] shrink-0">
        <Filter size={13} className="text-[var(--text-secondary)] shrink-0" />
        <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v ?? "__all__")}>
          <SelectTrigger className="h-7 w-[130px] text-xs bg-[var(--bg-primary)] border-[var(--border)] cursor-pointer">
            <SelectValue placeholder={t("channel")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allChannels")}</SelectItem>
            {channelOrder.map((ch) => (
              <SelectItem key={ch} value={ch}>
                {ch}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={agentFilter} onValueChange={(v) => setAgentFilter(v ?? "__all__")}>
          <SelectTrigger className="h-7 w-[130px] text-xs bg-[var(--bg-primary)] border-[var(--border)] cursor-pointer">
            <SelectValue placeholder={t("agentColumn")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allAgents")}</SelectItem>
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
          <div className="flex items-center justify-center h-32 text-xs text-[var(--text-secondary)]">
            <div
              className="animate-spin rounded-full h-5 w-5 border-2 border-current mr-2"
              style={{ borderTopColor: "transparent" }}
            />
            {tc("loading")}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-[var(--text-secondary)]">
            {t("noBindings")}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sorted.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[var(--text-secondary)]">
                    <th className="w-8" />
                    <th className="text-left px-3 py-2 font-medium">{t("tier")}</th>
                    <th className="text-left px-3 py-2 font-medium">{t("matchConditions")}</th>
                    <th className="text-left px-3 py-2 font-medium">{t("targetAgent")}</th>
                    <th className="text-right px-4 py-2 font-medium w-16">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((binding) => (
                    <SortableRow
                      key={binding.id}
                      binding={binding}
                      isDefault={binding.tier === "default"}
                      deletingId={deletingId}
                      conflicts={conflictMap.get(binding.id) ?? []}
                      onDelete={(id) => void handleDelete(id)}
                    />
                  ))}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* dmScope footer */}
      {dmScope && (
        <div className="px-4 py-2.5 border-t border-[var(--border-subtle)] shrink-0">
          <span className="text-[10px] text-[var(--text-secondary)] font-mono">
            {t("dmScope")}: <span className="text-[var(--text-primary)]">{dmScope}</span>
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
