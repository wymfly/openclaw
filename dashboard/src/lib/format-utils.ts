// ---------------------------------------------------------------------------
// Formatting utilities for chat metadata display (tokens, duration, params).
// ---------------------------------------------------------------------------

/**
 * Format a token count for display.
 * - <1000 → exact number ("42")
 * - >=1000 → abbreviated ("1.5k")
 * - 0 → "0"
 * - undefined → em-dash
 */
export function formatTokenCount(count: number | undefined): string {
  if (count === undefined) {
    return "\u2014";
  }
  if (count < 1000) {
    return String(count);
  }
  return `${(count / 1000).toFixed(1)}k`;
}

/**
 * Format a duration in milliseconds for display.
 * - <60s → "N.Ns" (one decimal)
 * - >=60s → "Nm Ns" (integer seconds)
 * - undefined → em-dash
 */
export function formatDuration(ms: number | undefined): string {
  if (ms === undefined) {
    return "\u2014";
  }
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format an object's keys as a summary string.
 * - Up to 3 key names joined with ", "
 * - More than 3 → first 3 + ellipsis
 * - Empty object → ""
 */
export function formatParamSummary(input: Record<string, unknown>): string {
  const keys = Object.keys(input);
  if (keys.length === 0) {
    return "";
  }
  if (keys.length <= 3) {
    return keys.join(", ");
  }
  return `${keys.slice(0, 3).join(", ")}, \u2026`;
}
