/* deck-go threads prototype v2 — mock data
 *
 * Contract: DeckGoThreadEntry + DeckGoThreadsResponse from
 * deck-go/contracts/source/deck-api.contract.ts
 *
 * threads is a *binding* registry — each entry maps a channel account ↔ a
 * deck-go agent ↔ a target session. There is NO transcript / message
 * contract. The detail view shows binding metadata + a BFF-projected recent
 * activity stream for the linked session, plus an "Open chat" cross-link.
 */

const NOW = Date.parse("2026-05-04T01:30:00Z");
const MIN = 60_000;
const HOUR = 3600_000;
const DAY = 86_400_000;

function ago(ms) {
  return NOW - ms;
}

const threads = [
  {
    threadId: "thr-discord-ops-1",
    channelId: "discord:ops-zone#alerts",
    agentId: "main",
    targetSessionKey: "sess-main",
    targetKind: "claude-code-session",
    boundAt: ago(7 * DAY),
    lastActivityAt: ago(4 * MIN),
    accountId: "ops-bot",
    boundBy: "operator:ymw@example.com",
    label: "Discord ops alerts → main session",
  },
  {
    threadId: "thr-telegram-onboarding",
    channelId: "telegram:1284912934",
    agentId: "onboarding",
    targetSessionKey: "sess-onboarding",
    targetKind: "agent-loop",
    boundAt: ago(2 * DAY + 4 * HOUR),
    lastActivityAt: ago(22 * MIN),
    accountId: "claw-onboard-bot",
    boundBy: "auto-binding",
    label: "Telegram onboarding (auto)",
  },
  {
    threadId: "thr-wecom-eng",
    channelId: "wecom:eng-leads",
    agentId: "build",
    targetSessionKey: "sess-build",
    targetKind: "claude-code-session",
    boundAt: ago(3 * HOUR + 14 * MIN),
    lastActivityAt: ago(1 * HOUR + 7 * MIN),
    accountId: "service",
    boundBy: "operator:ymw@example.com",
  },
  {
    threadId: "thr-qq-feedback",
    channelId: "qq:909123887",
    agentId: "feedback",
    targetSessionKey: "sess-feedback",
    targetKind: "agent-loop",
    boundAt: ago(11 * DAY),
    lastActivityAt: ago(3 * DAY + 1 * HOUR),
    accountId: "main",
    boundBy: "auto-binding",
    label: "QQ user feedback intake",
  },
  {
    threadId: "thr-slack-platform",
    channelId: "slack:U0XS41-platform",
    agentId: "platform",
    targetSessionKey: "sess-platform",
    targetKind: "external-bot",
    boundAt: ago(5 * DAY),
    lastActivityAt: ago(48 * MIN),
    accountId: "slack-platform",
    boundBy: "manual:legacy-importer",
    label: "Slack platform escalation",
  },
  {
    threadId: "thr-discord-incident",
    channelId: "discord:incidents#fire",
    agentId: "incident",
    targetSessionKey: "sess-incident-2026-05-03",
    targetKind: "claude-code-session",
    boundAt: ago(2 * HOUR + 39 * MIN),
    lastActivityAt: ago(11 * MIN),
    accountId: "ops-bot",
    boundBy: "operator:ymw@example.com",
    label: "Discord incident channel ↔ incident agent",
  },
  {
    threadId: "thr-telegram-cron",
    channelId: "telegram:9181229",
    agentId: "cron",
    targetSessionKey: "sess-cron",
    targetKind: "agent-loop",
    boundAt: ago(14 * DAY),
    lastActivityAt: ago(7 * DAY),
    accountId: "claw-cron-bot",
    boundBy: "auto-binding",
  },
  {
    threadId: "thr-wecom-product",
    channelId: "wecom:product-launch",
    agentId: "research",
    targetSessionKey: "sess-research-7",
    targetKind: "agent-loop",
    boundAt: ago(6 * HOUR),
    lastActivityAt: ago(2 * HOUR + 18 * MIN),
    accountId: "service",
    boundBy: "operator:lin@example.com",
    label: "WeCom product-launch room",
  },
  {
    threadId: "thr-discord-art",
    channelId: "discord:art-tools#design",
    agentId: "designer",
    targetSessionKey: "sess-designer-3",
    targetKind: "claude-code-session",
    boundAt: ago(9 * DAY),
    lastActivityAt: ago(13 * HOUR),
    accountId: "ops-bot",
    boundBy: "operator:ymw@example.com",
  },
  {
    threadId: "thr-slack-finance",
    channelId: "slack:U0XS41-finance",
    agentId: "finance-helper",
    targetSessionKey: "sess-finance-2",
    targetKind: "external-bot",
    boundAt: ago(20 * DAY),
    lastActivityAt: ago(5 * DAY + 4 * HOUR),
    accountId: "slack-finance",
    boundBy: "manual:legacy-importer",
  },
];

const channelKindFromId = (channelId) => channelId.split(":")[0];

const recentActivity = {
  // BFF projection over DeckGoMonitorRunEvent for sess-main
  "thr-discord-ops-1": [
    { ts: ago(4 * MIN), kind: "tool.call", title: "tool: read_file", note: "deck-go/AGENTS.md" },
    {
      ts: ago(12 * MIN),
      kind: "model.call",
      title: "model: sonnet-4.6",
      note: "tokens=2.4k duration=4.1s",
    },
    {
      ts: ago(38 * MIN),
      kind: "channel.inbound",
      title: "discord message",
      note: "from ops-bot — alert thread reply",
    },
    { ts: ago(52 * MIN), kind: "tool.call", title: "tool: apply_patch", note: "alerts.go +12 -4" },
    {
      ts: ago(2 * HOUR),
      kind: "agent.handoff",
      title: "main → codex (review)",
      note: "scope: backend test fixes",
    },
    {
      ts: ago(3 * HOUR + 11 * MIN),
      kind: "channel.outbound",
      title: "discord reply",
      note: "→ #alerts (3 lines)",
    },
  ],
  "thr-telegram-onboarding": [
    {
      ts: ago(22 * MIN),
      kind: "channel.inbound",
      title: "telegram message",
      note: 'from user 1284912934 — "我想试试"',
    },
    {
      ts: ago(24 * MIN),
      kind: "model.call",
      title: "model: sonnet-4.6",
      note: "tokens=820 duration=1.7s",
    },
    {
      ts: ago(25 * MIN),
      kind: "channel.outbound",
      title: "telegram reply",
      note: "→ user (welcome flow step 2)",
    },
    {
      ts: ago(48 * MIN),
      kind: "tool.call",
      title: "tool: search_kb",
      note: "query: onboarding faq #3",
    },
  ],
  "thr-wecom-eng": [
    {
      ts: ago(1 * HOUR + 7 * MIN),
      kind: "tool.call",
      title: "tool: run_tests",
      note: "pkg/server – 23/23 green",
    },
    {
      ts: ago(1 * HOUR + 22 * MIN),
      kind: "model.call",
      title: "model: gpt-5.4",
      note: "tokens=4.1k duration=8.9s",
    },
    {
      ts: ago(1 * HOUR + 41 * MIN),
      kind: "channel.inbound",
      title: "wecom message",
      note: "from service — build status?",
    },
    {
      ts: ago(2 * HOUR + 30 * MIN),
      kind: "tool.call",
      title: "tool: apply_patch",
      note: "deck.go +60 -8",
    },
  ],
  "thr-qq-feedback": [
    {
      ts: ago(3 * DAY + 1 * HOUR),
      kind: "channel.inbound",
      title: "qq message",
      note: 'from user 909123887 — "崩溃了"',
    },
    {
      ts: ago(3 * DAY + 1 * HOUR + 2 * MIN),
      kind: "model.call",
      title: "model: sonnet-4.6",
      note: "tokens=620 duration=1.2s",
    },
  ],
  "thr-slack-platform": [
    {
      ts: ago(48 * MIN),
      kind: "channel.inbound",
      title: "slack message",
      note: "from @sre-oncall — escalate latency",
    },
    {
      ts: ago(50 * MIN),
      kind: "agent.handoff",
      title: "platform → main (escalate)",
      note: "scope: latency triage",
    },
    {
      ts: ago(1 * HOUR + 34 * MIN),
      kind: "tool.call",
      title: "tool: search_logs",
      note: "service=router last=15m",
    },
  ],
  "thr-discord-incident": [
    {
      ts: ago(11 * MIN),
      kind: "tool.call",
      title: "tool: write_postmortem",
      note: "incident-2026-05-03.md",
    },
    {
      ts: ago(18 * MIN),
      kind: "model.call",
      title: "model: opus-4.7",
      note: "tokens=8.2k duration=24s",
    },
    {
      ts: ago(38 * MIN),
      kind: "channel.inbound",
      title: "discord message",
      note: "from ops-bot — root cause?",
    },
    {
      ts: ago(1 * HOUR + 11 * MIN),
      kind: "agent.handoff",
      title: "incident → main (debrief)",
      note: "scope: write incident report",
    },
    {
      ts: ago(2 * HOUR + 28 * MIN),
      kind: "channel.outbound",
      title: "discord post",
      note: "→ #fire (status update)",
    },
  ],
  "thr-telegram-cron": [
    {
      ts: ago(7 * DAY),
      kind: "model.call",
      title: "model: haiku-4.5",
      note: "tokens=140 duration=0.4s",
    },
    {
      ts: ago(7 * DAY + 2 * MIN),
      kind: "channel.outbound",
      title: "telegram digest",
      note: "→ subscribers (weekly)",
    },
  ],
  "thr-wecom-product": [
    {
      ts: ago(2 * HOUR + 18 * MIN),
      kind: "tool.call",
      title: "tool: search_web",
      note: "query: launch readiness",
    },
    {
      ts: ago(2 * HOUR + 22 * MIN),
      kind: "model.call",
      title: "model: sonnet-4.6",
      note: "tokens=3.7k duration=6.1s",
    },
    {
      ts: ago(3 * HOUR + 4 * MIN),
      kind: "channel.inbound",
      title: "wecom message",
      note: "from service — research status?",
    },
  ],
  "thr-discord-art": [
    { ts: ago(13 * HOUR), kind: "tool.call", title: "tool: render_design", note: "frame=hero v3" },
    {
      ts: ago(13 * HOUR + 9 * MIN),
      kind: "model.call",
      title: "model: opus-4.7",
      note: "tokens=2.0k duration=4.4s",
    },
  ],
  "thr-slack-finance": [
    {
      ts: ago(5 * DAY + 4 * HOUR),
      kind: "channel.inbound",
      title: "slack message",
      note: "from @cfo — quarterly?",
    },
    {
      ts: ago(5 * DAY + 4 * HOUR + 4 * MIN),
      kind: "model.call",
      title: "model: sonnet-4.6",
      note: "tokens=950 duration=2.0s",
    },
  ],
};

const auditTrail = {
  // BFF projection over Deck mutation log
  "thr-discord-ops-1": [
    {
      ts: ago(7 * DAY),
      actor: "operator:ymw@example.com",
      action: "bound",
      note: "discord:ops-zone#alerts → main",
    },
    {
      ts: ago(3 * DAY),
      actor: "system",
      action: "label-updated",
      note: "label: 'Discord ops alerts → main session'",
    },
  ],
  "thr-telegram-onboarding": [
    {
      ts: ago(2 * DAY + 4 * HOUR),
      actor: "system",
      action: "auto-bound",
      note: "first inbound from 1284912934",
    },
  ],
  "thr-wecom-eng": [
    {
      ts: ago(3 * HOUR + 14 * MIN),
      actor: "operator:ymw@example.com",
      action: "bound",
      note: "wecom:eng-leads → build",
    },
  ],
  "thr-qq-feedback": [
    {
      ts: ago(11 * DAY),
      actor: "system",
      action: "auto-bound",
      note: "first inbound from 909123887",
    },
    {
      ts: ago(8 * DAY),
      actor: "system",
      action: "label-set",
      note: "label: 'QQ user feedback intake'",
    },
  ],
  "thr-slack-platform": [
    {
      ts: ago(5 * DAY),
      actor: "manual:legacy-importer",
      action: "imported",
      note: "from previous deployment manifest",
    },
  ],
  "thr-discord-incident": [
    {
      ts: ago(2 * HOUR + 39 * MIN),
      actor: "operator:ymw@example.com",
      action: "bound",
      note: "incident channel → incident agent",
    },
  ],
  "thr-telegram-cron": [
    { ts: ago(14 * DAY), actor: "system", action: "auto-bound", note: "scheduled cron emit" },
  ],
  "thr-wecom-product": [
    {
      ts: ago(6 * HOUR),
      actor: "operator:lin@example.com",
      action: "bound",
      note: "wecom:product-launch → research",
    },
  ],
  "thr-discord-art": [
    {
      ts: ago(9 * DAY),
      actor: "operator:ymw@example.com",
      action: "bound",
      note: "discord:art-tools#design → designer",
    },
  ],
  "thr-slack-finance": [
    {
      ts: ago(20 * DAY),
      actor: "manual:legacy-importer",
      action: "imported",
      note: "from previous deployment manifest",
    },
  ],
};

const channelKinds = ["discord", "telegram", "wecom", "slack", "qq"];
const targetKinds = ["claude-code-session", "agent-loop", "external-bot"];

const responsePayload = {
  threads,
};

Object.assign(window, {
  __threadsData: {
    threads,
    response: responsePayload,
    recentActivity,
    auditTrail,
    channelKinds,
    targetKinds,
    channelKindFromId,
    NOW,
  },
});
