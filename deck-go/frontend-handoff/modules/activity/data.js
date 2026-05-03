// Contract-shaped mock data for activity prototype.
// Shapes match DeckGo* DTOs in deck-go/contracts/source/deck-api.contract.ts:
//   DeckGoActivityEvent, DeckGoActivityResponse.
//
// Activity is a thin contract — the BFF projects richer event types from
// Gateway lifecycle messages, agent run events, channel webhooks, and audit
// log writes. Anything beyond the bare DTO fields (severity, agentColor) is
// a BFF projection layered on top — flagged in api-usage.md.

const NOW = 1714680000000;

const EVENT_TYPES = [
  "agent.start",
  "agent.stop",
  "agent.error",
  "agent.handoff",
  "tool.call",
  "tool.result",
  "tool.deny",
  "message.in",
  "message.out",
  "subagent.spawn",
  "subagent.kill",
  "subagent.steer",
  "channel.connect",
  "channel.disconnect",
  "channel.error",
  "config.change",
  "auth.rotate",
  "alert.fire",
  "approval.request",
  "approval.grant",
  "approval.deny",
];

window.MOCK = {
  events: {
    events: generateEvents(),
  },
  kpis: { asOfMs: NOW, runtimeId: "deck-runtime-prod-01" },
};

function generateEvents() {
  const seeds = [
    {
      ts: NOW - 30 * 1000,
      type: "agent.handoff",
      agentId: "main",
      agentName: "Main",
      description: "Handed off ralph step 7 verification to Architect",
      details: "depth=1 spawnMode=blocking model=opus-4-7",
    },
    {
      ts: NOW - 60 * 1000,
      type: "subagent.spawn",
      agentId: "main",
      agentName: "Main",
      description: "Spawned Architect for ralph verification",
      details: "runId=run_bb7401",
    },
    {
      ts: NOW - 90 * 1000,
      type: "tool.call",
      agentId: "executor",
      agentName: "Executor",
      description: "Bash: pnpm tsc --noEmit",
      details: "cwd=/Users/wangym/workspace/agents/openclaw",
    },
    {
      ts: NOW - 120 * 1000,
      type: "tool.result",
      agentId: "executor",
      agentName: "Executor",
      description: "tsc completed in 8.2s · 0 errors",
      details: "exitCode=0",
    },
    {
      ts: NOW - 180 * 1000,
      type: "message.in",
      agentId: "main",
      agentName: "Main",
      description: "User: continue with US-005 subagents",
      details: "from telegram · acct_tg_main",
    },
    {
      ts: NOW - 240 * 1000,
      type: "message.out",
      agentId: "main",
      agentName: "Main",
      description: "Reply sent: 'Setting up subagents v2 scaffold…'",
      details: "via telegram",
    },
    {
      ts: NOW - 300 * 1000,
      type: "agent.start",
      agentId: "executor",
      agentName: "Executor",
      description: "Executor session attached for subagents implementation",
      details: "sessionKey=sess_aa3201",
    },
    {
      ts: NOW - 360 * 1000,
      type: "tool.deny",
      agentId: "executor",
      agentName: "Executor",
      description: "Bash blocked: rm -rf node_modules (policy: protect-deps)",
      details: "policy=writer.fs.write rule=protect-deps",
    },
    {
      ts: NOW - 420 * 1000,
      type: "subagent.steer",
      agentId: "main",
      agentName: "Main",
      description: "Injected hint into Executor: use bounded retry",
      details: "runId=run_aa3201 dedupKey=dk_42_aa3201",
    },
    {
      ts: NOW - 480 * 1000,
      type: "alert.fire",
      agentId: null,
      agentName: null,
      description: "Alert fired: discord-provider WebSocket reconnect threshold reached",
      details: "rule=ws-reconnect threshold=3 cooldown=5m",
    },
    {
      ts: NOW - 600 * 1000,
      type: "channel.disconnect",
      agentId: null,
      agentName: null,
      description: "Discord WebSocket disconnected: code 1006",
      details: "channel=discord account=acct_disc_bot",
    },
    {
      ts: NOW - 720 * 1000,
      type: "channel.connect",
      agentId: null,
      agentName: null,
      description: "Discord WebSocket reconnected after 12s backoff",
      details: "channel=discord account=acct_disc_bot",
    },
    {
      ts: NOW - 900 * 1000,
      type: "config.change",
      agentId: null,
      agentName: null,
      description: "User updated channels.discord.heartbeatMs from 30000 to 25000",
      details: "actor=wangym configHash=abc123→def456",
    },
    {
      ts: NOW - 1200 * 1000,
      type: "tool.call",
      agentId: "explore",
      agentName: "Explore",
      description: "Grep: 'DeckGoActivity' in deck-api.contract.ts",
      details: "limit=50",
    },
    {
      ts: NOW - 1500 * 1000,
      type: "approval.request",
      agentId: "executor",
      agentName: "Executor",
      description: "Approval requested: gh pr merge --squash 1234",
      details: "scope=git.write expiresIn=10m",
    },
    {
      ts: NOW - 1500 * 1000 + 30000,
      type: "approval.grant",
      agentId: "executor",
      agentName: "Executor",
      description: "Approval granted by wangym",
      details: "approvalId=apr_001 latency=30s",
    },
    {
      ts: NOW - 1800 * 1000,
      type: "agent.error",
      agentId: "test-engineer",
      agentName: "Test Engineer",
      description: "Test runner failed: Playwright launch timeout",
      details: "PLAYWRIGHT_BROWSERS_PATH=missing",
    },
    {
      ts: NOW - 2100 * 1000,
      type: "auth.rotate",
      agentId: null,
      agentName: null,
      description: "GITHUB_TOKEN rotated for github-tools plugin",
      details: "plugin=github-tools rotateBy=wangym",
    },
    {
      ts: NOW - 2700 * 1000,
      type: "subagent.kill",
      agentId: "main",
      agentName: "Main",
      description: "Killed Executor run for wecom retry hardening",
      details: "runId=run_hh4422 reason=user-requested",
    },
    {
      ts: NOW - 3600 * 1000,
      type: "agent.stop",
      agentId: "writer",
      agentName: "Writer",
      description: "Writer session ended (release notes drafted)",
      details: "duration=4m",
    },
  ];

  // Pad with synthetic events to reach 50+ for virtualization demo.
  const padded = [...seeds];
  for (let i = seeds.length; i < 60; i++) {
    const baseTs = NOW - (3600 + (i - seeds.length) * 240) * 1000;
    const type = EVENT_TYPES[i % EVENT_TYPES.length];
    const isAgentEvent =
      !type.startsWith("channel") &&
      !type.startsWith("config") &&
      !type.startsWith("auth") &&
      !type.startsWith("alert");
    const agentId = isAgentEvent
      ? ["main", "executor", "explore", "architect", "verifier", "writer"][i % 6]
      : null;
    padded.push({
      ts: baseTs,
      type,
      agentId,
      agentName: agentId ? agentId.charAt(0).toUpperCase() + agentId.slice(1) : null,
      description: synthDescription(type, agentId, i),
      details: synthDetails(type, i),
    });
  }
  return padded.map((ev, idx) => ({
    id: `evt_${idx.toString(36)}_${ev.ts}`,
    timestamp: ev.ts,
    type: ev.type,
    agentId: ev.agentId || undefined,
    agentName: ev.agentName || undefined,
    description: ev.description,
    details: ev.details,
  }));
}

function synthDescription(type, agentId, idx) {
  if (type === "tool.call")
    return `Bash: ${["ls", "git status", "pnpm test", "pnpm check", "node -v"][idx % 5]}`;
  if (type === "tool.result")
    return `Tool result: exitCode=0 (${idx % 3 === 0 ? "stdout 32 lines" : "no stdout"})`;
  if (type === "tool.deny")
    return `Tool denied by policy: ${["fs.write", "network.outbound", "process.spawn"][idx % 3]}`;
  if (type === "message.in")
    return `User message received via ${["telegram", "discord", "wecom"][idx % 3]}`;
  if (type === "message.out") return `Reply sent: 200 chars`;
  if (type === "agent.start") return `${agentId || "agent"} session started`;
  if (type === "agent.stop") return `${agentId || "agent"} session ended`;
  if (type === "agent.error") return `${agentId || "agent"} hit recoverable error`;
  if (type === "agent.handoff") return `${agentId || "agent"} handed off control`;
  if (type === "subagent.spawn") return `Spawned subagent (idx ${idx})`;
  if (type === "subagent.kill") return `Killed subagent run`;
  if (type === "subagent.steer") return `Steered subagent`;
  if (type === "channel.connect") return `${["discord", "telegram", "wecom"][idx % 3]} connected`;
  if (type === "channel.disconnect")
    return `${["discord", "telegram", "wecom"][idx % 3]} disconnected`;
  if (type === "channel.error") return `Channel error: handshake timeout`;
  if (type === "config.change") return `Config patched (path ${idx % 5})`;
  if (type === "auth.rotate") return `Credential rotated`;
  if (type === "alert.fire")
    return `Alert fired: ${["throughput", "queue", "ws-reconnect"][idx % 3]}`;
  if (type === "approval.request") return `Approval requested for sensitive command`;
  if (type === "approval.grant") return `Approval granted`;
  if (type === "approval.deny") return `Approval denied`;
  return `${type} (synthetic ${idx})`;
}

function synthDetails(type, idx) {
  if (type.startsWith("tool")) return `cwd=/repo · idx=${idx}`;
  if (type.startsWith("subagent")) return `runId=run_${idx.toString(36)}`;
  if (type.startsWith("channel")) return `account=acct_${idx % 5}`;
  if (type.startsWith("approval")) return `latency=${(idx * 7) % 90}s`;
  return null;
}
