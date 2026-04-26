export function contextPct(session: {
  contextWindow: number;
  tokensIn: number;
  tokensOut: number;
  totalTokens?: number;
}): number {
  if (session.contextWindow <= 0) {
    return 0;
  }
  const used = session.totalTokens ?? session.tokensIn + session.tokensOut;
  return Math.min(100, Math.round((used / session.contextWindow) * 100));
}

export function pressureState(pct: number): "ok" | "warning" | "critical" {
  if (pct >= 80) {
    return "critical";
  }
  if (pct >= 60) {
    return "warning";
  }
  return "ok";
}

export function formatTokens(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return String(value);
}
