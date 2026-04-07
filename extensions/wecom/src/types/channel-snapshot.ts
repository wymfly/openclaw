/**
 * Extended snapshot for WeCom accounts — carries transport/health fields
 * beyond the base ChannelAccountSnapshot contract.
 *
 * Self-contained (no `extends ChannelAccountSnapshot`) because the extension's
 * isolated tsconfig cannot resolve `openclaw/plugin-sdk/wecom` at typecheck
 * time.  All base fields used by `buildChannelSummary` / `buildAccountSnapshot`
 * are declared directly.
 */
export interface WecomChannelSnapshot {
  // --- Base ChannelAccountSnapshot fields used by the status section ---
  accountId?: string;
  name?: string;
  enabled?: boolean;
  configured?: boolean;
  running?: boolean;
  webhookPath?: string | null;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  lastInboundAt?: number | null;
  lastOutboundAt?: number | null;
  connected?: boolean;
  probe?: unknown;
  lastProbeAt?: number | null;
  dmPolicy?: string;

  // --- WeCom-specific fields ---
  transport?: string | null;
  ownerId?: string | null;
  health?: string;
  ownerDriftAt?: number | null;
  authenticated?: boolean;
  lastErrorAt?: number | null;
  recentInboundSummary?: string | null;
  recentOutboundSummary?: string | null;
  recentIssueCategory?: string | null;
  recentIssueSummary?: string | null;
  transportSessions?: string[];
  primaryTransport?: string | null;
}
