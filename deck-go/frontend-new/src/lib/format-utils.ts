export function formatTokenCount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "0";
  }
  return value.toLocaleString("en-US");
}

export function formatDuration(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "0s";
  }
  const totalSeconds = Math.max(0, Math.round(value / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export function formatParamSummary(input: Record<string, unknown>): string {
  const keys = Object.keys(input);
  if (keys.length === 0) {
    return "";
  }
  if (keys.length <= 3) {
    return keys.join(", ");
  }
  return `${keys.slice(0, 3).join(", ")}, ...`;
}
