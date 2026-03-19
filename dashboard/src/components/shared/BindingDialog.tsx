"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAgentsStore } from "@/stores/agents";
import { useChannelsStore } from "@/stores/channels";
import { useDeckRoutingStore, type BindingMatch } from "@/stores/deck-routing";

interface BindingDialogProps {
  open: boolean;
  mode: "add" | "edit";
  prefill?: {
    agentId?: string;
    channel?: string;
    accountId?: string;
  };
  onSave: (match: BindingMatch, agentId: string) => void;
  onCancel: () => void;
}

/**
 * Dialog for adding/editing a routing binding. Dynamic fields based on
 * channel selection (Discord shows Guild/Roles, Slack shows Team).
 * Real-time validation via deck.routing.validate.
 */
export function BindingDialog({ open, mode, prefill, onSave, onCancel }: BindingDialogProps) {
  const agents = useAgentsStore((s) => s.agents);
  const channels = useChannelsStore((s) => s.channelOrder);
  const validateBinding = useDeckRoutingStore((s) => s.validateBinding);
  const validating = useDeckRoutingStore((s) => s.validating);
  const validationResult = useDeckRoutingStore((s) => s.validationResult);

  const [agentId, setAgentId] = useState(prefill?.agentId ?? "");
  const [channel, setChannel] = useState(prefill?.channel ?? "");
  const [accountId, setAccountId] = useState(prefill?.accountId ?? "");
  const [peerKind, setPeerKind] = useState("");
  const [peerId, setPeerId] = useState("");
  const [guild, setGuild] = useState("");
  const [roles, setRoles] = useState("");
  const [team, setTeam] = useState("");

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setAgentId(prefill?.agentId ?? "");
      setChannel(prefill?.channel ?? "");
      setAccountId(prefill?.accountId ?? "");
      setPeerKind("");
      setPeerId("");
      setGuild("");
      setRoles("");
      setTeam("");
    }
  }, [open, prefill]);

  const isDiscord = channel === "discord";
  const isSlack = channel === "slack";

  const buildMatch = useCallback((): BindingMatch => {
    const match: BindingMatch = { channel };
    if (accountId) {
      match.accountId = accountId;
    }
    if (peerKind && peerId) {
      match.peer = { kind: peerKind, id: peerId };
    }
    if (isDiscord && guild) {
      match.guild = guild;
    }
    if (isDiscord && roles) {
      match.roles = roles
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);
    }
    if (isSlack && team) {
      match.team = team;
    }
    return match;
  }, [channel, accountId, peerKind, peerId, guild, roles, team, isDiscord, isSlack]);

  // Real-time validation when fields change
  useEffect(() => {
    if (!channel) {
      return;
    }
    const timer = setTimeout(() => {
      void validateBinding(buildMatch(), agentId || undefined);
    }, 500);
    return () => clearTimeout(timer);
  }, [
    channel,
    accountId,
    peerKind,
    peerId,
    guild,
    roles,
    team,
    agentId,
    buildMatch,
    validateBinding,
  ]);

  const handleSave = () => {
    if (!channel || !agentId) {
      return;
    }
    onSave(buildMatch(), agentId);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="bg-[var(--bg-secondary)] border-[var(--border)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)]">
            {mode === "add" ? "Add Routing Rule" : "Edit Routing Rule"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Agent */}
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-secondary)]">Target Agent</Label>
            <Select value={agentId} onValueChange={(v) => setAgentId(v ?? "")}>
              <SelectTrigger className="bg-[var(--bg-primary)] border-[var(--border)] cursor-pointer">
                <SelectValue placeholder="Select agent..." />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name || a.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Channel */}
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-secondary)]">Channel</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v ?? "")}>
              <SelectTrigger className="bg-[var(--bg-primary)] border-[var(--border)] cursor-pointer">
                <SelectValue placeholder="Select channel..." />
              </SelectTrigger>
              <SelectContent>
                {channels.map((ch) => (
                  <SelectItem key={ch} value={ch}>
                    {ch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Account ID */}
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-secondary)]">Account ID (optional)</Label>
            <Input
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="e.g. srv-main"
              className="bg-[var(--bg-primary)] border-[var(--border)]"
            />
          </div>

          {/* Peer */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--text-secondary)]">Peer Kind</Label>
              <Select value={peerKind} onValueChange={(v) => setPeerKind(v ?? "")}>
                <SelectTrigger className="bg-[var(--bg-primary)] border-[var(--border)] cursor-pointer">
                  <SelectValue placeholder="Type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="channel">Channel</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--text-secondary)]">Peer ID</Label>
              <Input
                value={peerId}
                onChange={(e) => setPeerId(e.target.value)}
                placeholder="ID..."
                className="bg-[var(--bg-primary)] border-[var(--border)]"
              />
            </div>
          </div>

          {/* Discord-specific: Guild + Roles */}
          {isDiscord && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-[var(--text-secondary)]">Guild ID</Label>
                <Input
                  value={guild}
                  onChange={(e) => setGuild(e.target.value)}
                  placeholder="Discord Guild ID..."
                  className="bg-[var(--bg-primary)] border-[var(--border)]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[var(--text-secondary)]">
                  Roles (comma-separated)
                </Label>
                <Input
                  value={roles}
                  onChange={(e) => setRoles(e.target.value)}
                  placeholder="admin, moderator..."
                  className="bg-[var(--bg-primary)] border-[var(--border)]"
                />
              </div>
            </>
          )}

          {/* Slack-specific: Team */}
          {isSlack && (
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--text-secondary)]">Team ID</Label>
              <Input
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                placeholder="Slack Team ID..."
                className="bg-[var(--bg-primary)] border-[var(--border)]"
              />
            </div>
          )}

          {/* Validation result */}
          {validationResult && (
            <div
              className={cn(
                "rounded-md p-2.5 text-xs border",
                validationResult.valid
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400",
              )}
            >
              {validationResult.predictedTier && (
                <p>
                  Predicted tier: <strong>{validationResult.predictedTier}</strong>
                </p>
              )}
              {validationResult.conflicts?.map((c, i) => (
                <p key={i} className="mt-1">
                  Conflict: {c.description}
                </p>
              ))}
              {validationResult.warnings?.map((w, i) => (
                <p key={i} className="mt-1 text-amber-400">
                  {w}
                </p>
              ))}
            </div>
          )}
          {validating && (
            <Badge variant="outline" className="text-[10px] text-[var(--text-secondary)]">
              Validating...
            </Badge>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} className="cursor-pointer">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!channel || !agentId} className="cursor-pointer">
            {mode === "add" ? "Add Rule" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
