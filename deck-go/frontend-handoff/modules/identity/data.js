// data.js — fixture for the identity workbench.
//
// Source contract: deck-go/contracts/source/deck-api.contract.ts
//   DeckGoIdentityPeer        = { channel: string; peerId: string }
//   DeckGoIdentityLink        = { canonical: string; peers: DeckGoIdentityPeer[] }
//   DeckGoIdentityLinksResponse = { links: DeckGoIdentityLink[]; configHash?: string }
//
// Mutation endpoints:
//   GET  /api/deck/identity                      → DeckGoIdentityLinksResponse
//   POST /api/deck/identity                      → updates link set; baseHash-guarded (409 on drift)
//   GET  /api/agents/{agentId}/identity          → DeckGoAgentIdentityResponse (per-agent profile)
//
// PeerActivity (last seen / last linked) is BFF-projected — not in raw contract.

(function (root) {
  const NOW = Date.parse("2026-05-04T11:42:00Z");

  const fixture = {
    configHash: "identity-hash-visual-2",
    fetchedAt: NOW,
    canonicals: [
      {
        canonical: "main",
        description: "Primary operator canonical — Daisy across personal channels.",
        createdAtMs: Date.parse("2026-02-12T10:00:00Z"),
        peers: [
          {
            channel: "telegram",
            peerId: "tg-daisy-personal",
            displayName: "Daisy Wong",
            lastSeenMs: NOW - 8 * 60 * 1000,
            lastLinkedMs: Date.parse("2026-04-28T08:01:00Z"),
            actor: "operator:daisy@deck.local",
          },
          {
            channel: "discord",
            peerId: "disc-2189142",
            displayName: "daisy#0042",
            lastSeenMs: NOW - 32 * 60 * 1000,
            lastLinkedMs: Date.parse("2026-04-22T19:14:00Z"),
            actor: "operator:daisy@deck.local",
          },
          {
            channel: "wecom",
            peerId: "wecom-DaisyW",
            displayName: "Daisy Wong (王雨萌)",
            lastSeenMs: NOW - 14 * 60 * 60 * 1000,
            lastLinkedMs: Date.parse("2026-04-30T02:08:00Z"),
            actor: "operator:daisy@deck.local",
          },
        ],
      },
      {
        canonical: "team-builder",
        description: "Shared product-builder canonical — Sam + Liu rotating.",
        createdAtMs: Date.parse("2026-03-04T14:00:00Z"),
        peers: [
          {
            channel: "slack",
            peerId: "slack-U-LIU-PROD",
            displayName: "Liu Bo",
            lastSeenMs: NOW - 4 * 60 * 1000,
            lastLinkedMs: Date.parse("2026-04-29T11:00:00Z"),
            actor: "operator:sam@deck.local",
          },
          {
            channel: "slack",
            peerId: "slack-U-SAM-PROD",
            displayName: "Sam Park",
            lastSeenMs: NOW - 22 * 60 * 1000,
            lastLinkedMs: Date.parse("2026-04-29T11:00:00Z"),
            actor: "operator:sam@deck.local",
          },
        ],
      },
      {
        canonical: "ops-rotation",
        description: "Oncall rotation canonical — auto-mapped by hooks/ops-rotation.json.",
        createdAtMs: Date.parse("2026-01-09T08:00:00Z"),
        peers: [
          {
            channel: "telegram",
            peerId: "tg-oncall-bot",
            displayName: "Oncall (rotation)",
            lastSeenMs: NOW - 90 * 1000,
            lastLinkedMs: Date.parse("2026-04-30T02:00:00Z"),
            actor: "automation:hooks/ops-rotation",
          },
          {
            channel: "email",
            peerId: "oncall@deck.local",
            displayName: "oncall@deck.local",
            lastSeenMs: NOW - 6 * 60 * 60 * 1000,
            lastLinkedMs: Date.parse("2026-03-09T08:00:00Z"),
            actor: "automation:hooks/ops-rotation",
          },
        ],
      },
      {
        canonical: "review-pool",
        description: "Reserved review canonical — empty, ready to bind a guarded reviewer.",
        createdAtMs: Date.parse("2026-04-12T10:00:00Z"),
        peers: [],
      },
      {
        canonical: "system",
        description: "System canonical — used by BFF for system-issued events.",
        createdAtMs: Date.parse("2026-01-01T00:00:00Z"),
        peers: [
          {
            channel: "discord",
            peerId: "disc-deckgo-system",
            displayName: "deckgo-system",
            lastSeenMs: NOW - 60 * 1000,
            lastLinkedMs: Date.parse("2026-01-01T00:00:00Z"),
            actor: "system",
          },
        ],
      },
    ],
    recentMutations: [
      {
        ts: NOW - 4 * 60 * 1000,
        kind: "link-peer",
        actor: "operator:daisy@deck.local",
        canonical: "main",
        peer: { channel: "wecom", peerId: "wecom-DaisyW" },
        ok: true,
      },
      {
        ts: NOW - 19 * 60 * 1000,
        kind: "unlink-peer",
        actor: "operator:sam@deck.local",
        canonical: "team-builder",
        peer: { channel: "slack", peerId: "slack-U-OLD-DEPRECATED" },
        ok: true,
      },
      {
        ts: NOW - 41 * 60 * 1000,
        kind: "rename-canonical",
        actor: "operator:sam@deck.local",
        canonical: "team-builder",
        from: "team",
        to: "team-builder",
        ok: true,
      },
      {
        ts: NOW - 2 * 60 * 60 * 1000,
        kind: "link-peer",
        actor: "operator:liu@deck.local",
        canonical: "team-builder",
        peer: { channel: "slack", peerId: "slack-U-LIU-PROD" },
        ok: false,
        error: "baseHash drift — refresh & retry",
      },
    ],
    channels: [
      { id: "telegram", label: "Telegram" },
      { id: "discord", label: "Discord" },
      { id: "slack", label: "Slack" },
      { id: "wecom", label: "WeCom" },
      { id: "email", label: "Email" },
    ],
    bootstrap: {
      ok: true,
      runtime: { mode: "remote", status: "running", health: "healthy" },
      gateway: { connected: true, schemaVersion: "2026-04-29-v3" },
    },
    agentProfile: {
      agentId: "main",
      name: "Daisy",
      avatar: null,
      emoji: "🌼",
    },
  };

  root.IDENTITY_FIXTURE = fixture;
})(typeof window !== "undefined" ? window : globalThis);
