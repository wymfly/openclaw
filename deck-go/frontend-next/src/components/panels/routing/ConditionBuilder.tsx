"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChannelsStore } from "@/stores/channels";
import type { BindingMatch } from "@/stores/deck-routing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const ALL_DIMENSIONS = ["channel", "accountId", "peer", "guildId", "roles", "teamId"] as const;
type Dimension = (typeof ALL_DIMENSIONS)[number];

const DIM_KEYS: Record<Dimension, string> = {
  channel: "dimChannel",
  accountId: "dimAccountId",
  peer: "dimPeer",
  guildId: "dimGuildId",
  roles: "dimRoles",
  teamId: "dimTeamId",
};

interface ConditionBuilderProps {
  match: Partial<BindingMatch>;
  onChange: (match: Partial<BindingMatch>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConditionBuilder({ match, onChange }: ConditionBuilderProps) {
  const t = useTranslations("routing");
  const channelOrder = useChannelsStore((s) => s.channelOrder);

  const activeDimensions = ALL_DIMENSIONS.filter(
    (d) => (match as Record<string, unknown>)[d] !== undefined,
  );
  const availableDimensions = ALL_DIMENSIONS.filter(
    (d) => (match as Record<string, unknown>)[d] === undefined,
  );

  const addDimension = (dim: Dimension) => {
    const next = { ...match };
    switch (dim) {
      case "channel":
        next.channel = "";
        break;
      case "accountId":
        next.accountId = "";
        break;
      case "peer":
        next.peer = { kind: "", id: "" };
        break;
      case "guildId":
        next.guildId = "";
        break;
      case "roles":
        next.roles = [];
        break;
      case "teamId":
        next.teamId = "";
        break;
    }
    onChange(next);
  };

  const removeDimension = (dim: Dimension) => {
    const next = { ...match };
    delete (next as Record<string, unknown>)[dim];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {activeDimensions.map((dim) => (
        <div key={dim} className="flex items-center gap-2">
          <span className="shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-[var(--primary-muted)] text-[var(--primary)]">
            {t(DIM_KEYS[dim])}
          </span>

          <div className="flex-1 min-w-0">{renderInput(dim)}</div>

          <button
            type="button"
            onClick={() => removeDimension(dim)}
            className="shrink-0 p-0.5 rounded text-[var(--muted-foreground)] hover:text-red-400 transition-colors cursor-pointer"
            title={t("removeDimension")}
          >
            <X size={14} />
          </button>
        </div>
      ))}

      {availableDimensions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-dashed border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--primary)] transition-colors cursor-pointer">
            <Plus size={12} />
            {t("addCondition")}
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {availableDimensions.map((dim) => (
              <DropdownMenuItem key={dim} onClick={() => addDimension(dim)}>
                {t(DIM_KEYS[dim])}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  // ---- Per-dimension input controls ----

  function renderInput(dim: Dimension) {
    switch (dim) {
      case "channel":
        return (
          <Select
            value={match.channel ?? ""}
            onValueChange={(v) => onChange({ ...match, channel: v ?? "" })}
          >
            <SelectTrigger className="h-7 text-xs bg-[var(--background)] border-[var(--border)] cursor-pointer">
              <SelectValue placeholder={t("selectChannel")} />
            </SelectTrigger>
            <SelectContent>
              {channelOrder.map((ch) => (
                <SelectItem key={ch} value={ch}>
                  {ch}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "accountId":
        return (
          <Input
            value={match.accountId ?? ""}
            onChange={(e) => onChange({ ...match, accountId: e.target.value })}
            placeholder={t("accountIdPlaceholder")}
            className="h-7 text-xs bg-[var(--background)] border-[var(--border)]"
          />
        );

      case "peer":
        return (
          <div className="flex gap-1.5">
            <Select
              value={match.peer?.kind ?? ""}
              onValueChange={(v) =>
                onChange({ ...match, peer: { kind: v ?? "", id: match.peer?.id ?? "" } })
              }
            >
              <SelectTrigger className="h-7 w-[100px] text-xs bg-[var(--background)] border-[var(--border)] cursor-pointer">
                <SelectValue placeholder={t("peerKindPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">{t("peerDirect")}</SelectItem>
                <SelectItem value="group">{t("peerGroup")}</SelectItem>
                <SelectItem value="channel">{t("peerChannel")}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={match.peer?.id ?? ""}
              onChange={(e) =>
                onChange({ ...match, peer: { kind: match.peer?.kind ?? "", id: e.target.value } })
              }
              placeholder={t("peerIdPlaceholder")}
              className="h-7 text-xs flex-1 bg-[var(--background)] border-[var(--border)]"
            />
          </div>
        );

      case "guildId":
        return (
          <Input
            value={match.guildId ?? ""}
            onChange={(e) => onChange({ ...match, guildId: e.target.value })}
            placeholder={t("guildIdPlaceholder")}
            className="h-7 text-xs bg-[var(--background)] border-[var(--border)]"
          />
        );

      case "roles":
        return (
          <Input
            value={match.roles?.join(", ") ?? ""}
            onChange={(e) =>
              onChange({
                ...match,
                roles: e.target.value
                  .split(",")
                  .map((r) => r.trim())
                  .filter(Boolean),
              })
            }
            placeholder={t("rolesPlaceholder")}
            className="h-7 text-xs bg-[var(--background)] border-[var(--border)]"
          />
        );

      case "teamId":
        return (
          <Input
            value={match.teamId ?? ""}
            onChange={(e) => onChange({ ...match, teamId: e.target.value })}
            placeholder={t("teamIdPlaceholder")}
            className="h-7 text-xs bg-[var(--background)] border-[var(--border)]"
          />
        );
    }
  }
}
