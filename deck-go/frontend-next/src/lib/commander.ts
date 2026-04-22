/**
 * Simplified alert classification for the dashboard.
 *
 * Transplanted from vendor/openclaw-control-center with heavy simplification:
 * only the alert classification logic is retained; full runtime, task-store,
 * and ReadModelSnapshot dependencies are removed.
 */

export type AlertLevel = "info" | "warning" | "critical";

export type AlertCode = "NO_SESSIONS" | "HAS_ERRORS" | "HAS_BLOCKED";

export interface StatusEntry {
  type: string;
  count: number;
  hasErrors: boolean;
}

export interface CommanderAlert {
  level: AlertLevel;
  code: AlertCode;
  message: string;
}

/**
 * Classify a set of status entries into actionable alerts.
 *
 * Rules:
 * - If a "session" entry exists with count === 0 -> critical NO_SESSIONS
 * - If any entry has hasErrors === true -> warning HAS_ERRORS
 * - If a "blocked" entry exists with count > 0 -> warning HAS_BLOCKED
 */
export function classifyAlerts(entries: StatusEntry[]): CommanderAlert[] {
  const alerts: CommanderAlert[] = [];

  const sessionEntry = entries.find((e) => e.type === "session");
  if (sessionEntry && sessionEntry.count === 0) {
    alerts.push({
      level: "critical",
      code: "NO_SESSIONS",
      message: "No active sessions detected.",
    });
  }

  const hasErrors = entries.some((e) => e.hasErrors);
  if (hasErrors) {
    alerts.push({
      level: "warning",
      code: "HAS_ERRORS",
      message: "One or more entries are in error state.",
    });
  }

  const blockedEntry = entries.find((e) => e.type === "blocked");
  if (blockedEntry && blockedEntry.count > 0) {
    alerts.push({
      level: "warning",
      code: "HAS_BLOCKED",
      message: `${blockedEntry.count} session(s) are blocked or waiting approval.`,
    });
  }

  return alerts;
}
