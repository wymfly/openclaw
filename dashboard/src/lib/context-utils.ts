/**
 * Compute context usage percentage from a session's token data.
 * Uses tokensIn + tokensOut vs contextWindow (updated by SSE sessions.changed).
 */
export function contextPct(session: {
  contextWindow: number;
  tokensIn: number;
  tokensOut: number;
  totalTokens?: number;
}): number {
  if (session.contextWindow <= 0) {
    return 0;
  }
  // Prefer totalTokens (last API call snapshot — accurate post-compaction)
  // over cumulative tokensIn + tokensOut which overstates after compaction.
  const used = session.totalTokens ?? session.tokensIn + session.tokensOut;
  return Math.min(100, Math.round((used / session.contextWindow) * 100));
}

/** Colour class for the pressure bar fill based on percentage. */
export function pressureBarClass(pct: number): string {
  if (pct >= 80) {
    return "bg-[var(--destructive)]";
  }
  if (pct >= 60) {
    return "bg-[var(--warning)]";
  }
  return "bg-[var(--success)]";
}

/** Colour class for pressure text based on percentage. */
export function pressureTextClass(pct: number): string {
  if (pct >= 80) {
    return "text-[var(--destructive)]";
  }
  if (pct >= 60) {
    return "text-[var(--warning)]";
  }
  return "text-[var(--success)]";
}

/** Human-friendly token count (e.g. 1.2K, 3.5M). */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return String(n);
}
