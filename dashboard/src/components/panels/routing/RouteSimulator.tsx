"use client";

import { Play, RotateCcw } from "lucide-react";
import { useState } from "react";
import { AgentBadge } from "@/components/shared/AgentBadge";
import { SessionKeyDisplay } from "@/components/shared/SessionKeyDisplay";
import { TierBadge } from "@/components/shared/TierBadge";
import { Button } from "@/components/ui/button";
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
import { useDeckRoutingStore } from "@/stores/deck-routing";

/** All tiers in evaluation order. */
const ALL_TIERS = [
  "peer",
  "peer.parent",
  "guild+roles",
  "guild",
  "team",
  "account",
  "channel",
  "default",
];

export function RouteSimulator() {
  const { simulate, simulating, simulationResult, clearSimulation } = useDeckRoutingStore();
  const channelOrder = useChannelsStore((s) => s.channelOrder);
  const agents = useAgentsStore((s) => s.agents);

  const [channel, setChannel] = useState("");
  const [accountId, setAccountId] = useState("");
  const [peerType, setPeerType] = useState("");
  const [peerId, setPeerId] = useState("");
  const [guildId, setGuildId] = useState("");
  const [roles, setRoles] = useState("");
  const [teamId, setTeamId] = useState("");

  const isDiscord = channel === "discord";
  const isSlack = channel === "slack";

  const handleSimulate = () => {
    const params: Record<string, unknown> = { channel };
    if (accountId) {
      params.accountId = accountId;
    }
    if (peerType && peerId) {
      params.peer = { kind: peerType, id: peerId };
    }
    if (isDiscord && guildId) {
      params.guildId = guildId;
    }
    if (isDiscord && roles) {
      params.memberRoleIds = roles
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);
    }
    if (isSlack && teamId) {
      params.teamId = teamId;
    }
    void simulate(params);
  };

  const handleReset = () => {
    setChannel("");
    setAccountId("");
    setPeerType("");
    setPeerId("");
    setGuildId("");
    setRoles("");
    setTeamId("");
    clearSimulation();
  };

  // Find agent details for the matched agent
  const matchedAgent = simulationResult
    ? agents.find((a) => a.id === simulationResult.agentId)
    : null;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Route Simulator</h3>
        <button
          type="button"
          onClick={handleReset}
          className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
          title="Reset form"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-auto min-h-0 px-4 py-3 space-y-3">
        {/* Channel */}
        <div className="space-y-1.5">
          <Label className="text-xs text-[var(--text-secondary)]">Channel</Label>
          <Select value={channel} onValueChange={(v) => setChannel(v ?? "")}>
            <SelectTrigger className="h-8 text-xs bg-[var(--bg-primary)] border-[var(--border)] cursor-pointer">
              <SelectValue placeholder="Select channel..." />
            </SelectTrigger>
            <SelectContent>
              {channelOrder.map((ch) => (
                <SelectItem key={ch} value={ch}>
                  {ch}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Account ID */}
        <div className="space-y-1.5">
          <Label className="text-xs text-[var(--text-secondary)]">Account ID</Label>
          <Input
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="e.g. srv-main"
            className="h-8 text-xs bg-[var(--bg-primary)] border-[var(--border)]"
          />
        </div>

        {/* Peer */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-secondary)]">Peer Type</Label>
            <Select value={peerType} onValueChange={(v) => setPeerType(v ?? "")}>
              <SelectTrigger className="h-8 text-xs bg-[var(--bg-primary)] border-[var(--border)] cursor-pointer">
                <SelectValue placeholder="Type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">Direct</SelectItem>
                <SelectItem value="group">Group</SelectItem>
                <SelectItem value="channel">Channel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-secondary)]">Peer ID</Label>
            <Input
              value={peerId}
              onChange={(e) => setPeerId(e.target.value)}
              placeholder="ID..."
              className="h-8 text-xs bg-[var(--bg-primary)] border-[var(--border)]"
            />
          </div>
        </div>

        {/* Discord: Guild + Roles */}
        {isDiscord && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--text-secondary)]">Guild ID</Label>
              <Input
                value={guildId}
                onChange={(e) => setGuildId(e.target.value)}
                placeholder="Discord Guild ID..."
                className="h-8 text-xs bg-[var(--bg-primary)] border-[var(--border)]"
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
                className="h-8 text-xs bg-[var(--bg-primary)] border-[var(--border)]"
              />
            </div>
          </>
        )}

        {/* Slack: Team */}
        {isSlack && (
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--text-secondary)]">Team ID</Label>
            <Input
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              placeholder="Slack Team ID..."
              className="h-8 text-xs bg-[var(--bg-primary)] border-[var(--border)]"
            />
          </div>
        )}

        {/* Simulate button */}
        <Button
          onClick={handleSimulate}
          disabled={!channel || simulating}
          className="w-full h-8 gap-1.5 text-xs cursor-pointer"
        >
          {simulating ? (
            <>
              <div
                className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-current"
                style={{ borderTopColor: "transparent" }}
              />
              Simulating...
            </>
          ) : (
            <>
              <Play size={14} />
              Simulate Route
            </>
          )}
        </Button>

        {/* Results */}
        {simulationResult && (
          <div className="space-y-3 pt-1">
            {/* Matched agent */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                  Matched Agent
                </span>
                <TierBadge tier={simulationResult.matchedBy} />
              </div>
              <AgentBadge agentId={simulationResult.agentId} agentName={matchedAgent?.name} />
            </div>

            {/* Session key */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-3 space-y-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Session Key
              </span>
              <div className="overflow-x-auto">
                <SessionKeyDisplay sessionKey={simulationResult.sessionKey} />
              </div>
            </div>

            {/* Tier checklist */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-3 space-y-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-secondary)] block mb-2">
                Tier Evaluation
              </span>
              {ALL_TIERS.map((tier) => {
                const tierEntry = simulationResult.tiers.find((t) => t.tier === tier);
                const isMatched = tierEntry?.matched ?? false;
                return (
                  <div
                    key={tier}
                    className={cn(
                      "flex items-center gap-2 py-1 px-1.5 rounded text-xs",
                      isMatched && "bg-emerald-500/8",
                    )}
                  >
                    <span
                      className={cn(
                        "w-4 text-center shrink-0",
                        isMatched ? "text-emerald-400" : "text-[var(--text-secondary)] opacity-40",
                      )}
                    >
                      {isMatched ? "\u2705" : "\u2014"}
                    </span>
                    <TierBadge tier={tier} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
