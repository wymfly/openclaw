// Routing module fixtures.
// All shapes mirror DeckGo* DTOs from deck-go/contracts/source/deck-api.contract.ts:815-882.

window.BINDINGS = [
  {
    id: "7c61b9d2ea11",
    agentId: "ops",
    tier: "peer",
    match: {
      channel: "discord",
      accountId: "enterprise",
      peer: { kind: "direct", id: "finance-lead" },
    },
    comment: "Direct finance escalation — high-priority peer route",
  },
  {
    id: "4c892e17af32",
    agentId: "security",
    tier: "guild+roles",
    match: {
      channel: "discord",
      accountId: "enterprise",
      guildId: "openclaw-prod",
      roles: ["admin", "ops"],
    },
    comment: "Subset of Discord prod admins, falls through to channel route",
  },
  {
    id: "9a3f02bc1d77",
    agentId: "support",
    tier: "peer",
    match: {
      channel: "wecom",
      accountId: "default",
      peer: { kind: "group", id: "group-913" },
    },
    comment: "WeCom support group — office hours",
  },
  {
    id: "b8e5f7c910ab",
    agentId: "support",
    tier: "team",
    match: {
      channel: "slack",
      accountId: "openclaw",
      teamId: "T01ABC",
    },
    comment: "Slack workspace-wide support fallback",
  },
  {
    id: "3d2c6a90fe48",
    agentId: "ops",
    tier: "guild",
    match: {
      channel: "discord",
      accountId: "enterprise",
      guildId: "openclaw-prod",
    },
    comment: "Prod guild fallback — caught by ops if no role match",
  },
  {
    id: "5e1b8d33a112",
    agentId: "marketing",
    tier: "peer",
    match: {
      channel: "telegram",
      accountId: "ops-bot",
      peer: { kind: "channel", id: "telegram-marketing" },
    },
    comment: "Marketing channel announcements",
  },
  {
    id: "f7a04c61b2d9",
    agentId: "main",
    tier: "channel",
    match: { channel: "discord", accountId: "enterprise" },
    comment: "Broad Discord enterprise fallback",
  },
  {
    id: "c0441afda1c8",
    agentId: "main",
    tier: "channel",
    match: { channel: "wecom", accountId: "default" },
    comment: "Broad WeCom fallback",
  },
];

// Two advisory conflicts (local heuristic; backend may or may not echo).
window.LOCAL_CONFLICTS = {
  "4c892e17af32": [
    {
      type: "subset",
      bindingId: "3d2c6a90fe48",
      agentId: "ops",
      detail: "guild+roles binding is a subset of guild fallback (3d2c6a…); reorder may surprise.",
    },
  ],
  f7a04c61b2d9: [
    {
      type: "shadowed-by",
      bindingId: "7c61b9d2ea11",
      agentId: "ops",
      detail: "Channel fallback is shadowed by 2 more-specific peer/guild bindings above.",
    },
  ],
};

window.ROUTING_HEAD = {
  defaultAgentId: "main",
  dmScope: "per-channel-peer",
  configHash: "9af31c2d80ab",
};

window.DM_SCOPE_OPTIONS = ["per-channel-peer", "per-account-channel-peer", "per-peer", "main"];

window.PEER_KINDS = ["direct", "group", "channel"];
window.TIERS = ["peer", "guild+roles", "guild", "team", "channel"];
window.AGENT_OPTIONS = ["main", "ops", "security", "support", "marketing", "research"];
window.CHANNEL_OPTIONS = ["discord", "telegram", "wecom", "slack", "matrix", "signal"];

// Mock activity events filtered to routing-related types.
window.ACTIVITY_EVENTS = [
  {
    id: "evt-1",
    type: "routing.matched",
    summary: "Discord message matched peer binding",
    agentId: "ops",
    bindingId: "7c61b9d2ea11",
    atMs: Date.now() - 3 * 60_000,
  },
  {
    id: "evt-2",
    type: "route.fallback",
    summary: "WeCom support group fell through to channel route",
    agentId: "main",
    bindingId: "c0441afda1c8",
    atMs: Date.now() - 9 * 60_000,
  },
  {
    id: "evt-3",
    type: "routing.matched",
    summary: "Slack workspace fallback matched team binding",
    agentId: "support",
    bindingId: "b8e5f7c910ab",
    atMs: Date.now() - 17 * 60_000,
  },
  {
    id: "evt-4",
    type: "routing.config.updated",
    summary: "DM scope strategy changed: per-account-channel-peer → per-channel-peer",
    agentId: null,
    bindingId: null,
    atMs: Date.now() - 32 * 60_000,
  },
  {
    id: "evt-5",
    type: "routing.matched",
    summary: "Discord guild+roles binding matched admin",
    agentId: "security",
    bindingId: "4c892e17af32",
    atMs: Date.now() - 48 * 60_000,
  },
];

// Default simulator inputs.
window.SIMULATOR_DEFAULT = {
  channel: "discord",
  accountId: "enterprise",
  peer: { kind: "direct", id: "finance-lead" },
  guildId: "openclaw-prod",
  roles: "admin,ops",
};

// Simulator responder (in-process matcher matching the prototype binding fixtures).
window.simulateRoute = function simulateRoute(input, bindings) {
  // Derive the matched binding by walking the queue in priority order.
  for (const b of bindings) {
    const m = b.match;
    if (m.channel !== input.channel) continue;
    if (m.accountId && m.accountId !== input.accountId) continue;
    if (m.peer) {
      if (!input.peer || input.peer.kind !== m.peer.kind || input.peer.id !== m.peer.id) continue;
    }
    if (m.guildId && m.guildId !== input.guildId) continue;
    if (m.teamId && m.teamId !== input.teamId) continue;
    if (m.roles && m.roles.length) {
      const inputRoles = (input.roles || "")
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);
      if (!m.roles.every((r) => inputRoles.includes(r))) continue;
    }
    // Construct DeckGoRoutingSimulateResponse.
    const tiers = window.TIERS.map((t) => ({
      tier: t,
      matched: t === b.tier,
      checked: window.TIERS.indexOf(t) <= window.TIERS.indexOf(b.tier),
    }));
    return {
      agentId: b.agentId,
      matchedBy: b.id,
      sessionKey: `sess:${input.channel}:${input.accountId}:${
        input.peer?.id || input.guildId || input.teamId || "n/a"
      }`,
      tiers,
      bindingMatched: b,
    };
  }
  // No match — falls through to default agent.
  return {
    agentId: window.ROUTING_HEAD.defaultAgentId,
    matchedBy: "default",
    sessionKey: `sess:${input.channel}:${input.accountId || "n/a"}:default`,
    tiers: window.TIERS.map((t) => ({ tier: t, matched: false, checked: true })),
    bindingMatched: null,
  };
};

// Mock validation responder.
window.validateBinding = function validateBinding(draft, bindings) {
  const conflicts = [];
  // detect a duplicate match key
  for (const b of bindings) {
    if (
      b.agentId === draft.agentId &&
      b.match.channel === draft.match.channel &&
      b.match.accountId === draft.match.accountId &&
      b.match.peer?.kind === draft.match.peer?.kind &&
      b.match.peer?.id === draft.match.peer?.id
    ) {
      conflicts.push({
        type: "duplicate",
        bindingId: b.id,
        agentId: b.agentId,
        detail: "An identical binding already exists.",
      });
    }
  }
  return {
    ok: conflicts.length === 0,
    tier: draft.tier || (draft.match.peer ? "peer" : draft.match.guildId ? "guild" : "channel"),
    conflicts,
  };
};

// Mock add/remove responders return new configHash.
function newHash() {
  return Math.random().toString(16).slice(2, 14);
}
window.mockAddBinding = function mockAddBinding(draft) {
  const id = newHash();
  return {
    ok: true,
    binding: { ...draft, id, tier: draft.tier },
    configHash: newHash(),
    warnings: [],
  };
};
window.mockRemoveBinding = function mockRemoveBinding(binding) {
  return {
    ok: true,
    removed: binding,
    configHash: newHash(),
    impact: "1 binding removed; downstream order shifted.",
  };
};
window.mockPatchDmScope = function mockPatchDmScope(scope) {
  return {
    ok: true,
    dmScope: scope,
    configHash: newHash(),
  };
};
