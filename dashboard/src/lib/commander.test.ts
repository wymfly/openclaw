import { describe, it, expect } from "vitest";
import type { StatusEntry } from "./commander.js";
import { classifyAlerts } from "./commander.js";

describe("classifyAlerts", () => {
  it("returns empty array for healthy status (no errors, sessions present)", () => {
    const entries: StatusEntry[] = [
      { type: "session", count: 3, hasErrors: false },
      { type: "task", count: 5, hasErrors: false },
    ];
    expect(classifyAlerts(entries)).toEqual([]);
  });

  it("returns critical NO_SESSIONS alert when session count is 0", () => {
    const entries: StatusEntry[] = [{ type: "session", count: 0, hasErrors: false }];
    const alerts = classifyAlerts(entries);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      level: "critical",
      code: "NO_SESSIONS",
    });
    expect(alerts[0].message).toBeTruthy();
  });

  it("returns warning HAS_ERRORS alert when entries have errors", () => {
    const entries: StatusEntry[] = [{ type: "session", count: 5, hasErrors: true }];
    const alerts = classifyAlerts(entries);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      level: "warning",
      code: "HAS_ERRORS",
    });
  });

  it("returns warning HAS_BLOCKED alert for blocked entries", () => {
    const entries: StatusEntry[] = [{ type: "blocked", count: 2, hasErrors: false }];
    const alerts = classifyAlerts(entries);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      level: "warning",
      code: "HAS_BLOCKED",
    });
  });

  it("returns multiple alerts when multiple issues exist", () => {
    const entries: StatusEntry[] = [
      { type: "session", count: 0, hasErrors: false },
      { type: "blocked", count: 3, hasErrors: false },
      { type: "task", count: 2, hasErrors: true },
    ];
    const alerts = classifyAlerts(entries);
    const codes = alerts.map((a) => a.code);
    expect(codes).toContain("NO_SESSIONS");
    expect(codes).toContain("HAS_BLOCKED");
    expect(codes).toContain("HAS_ERRORS");
  });

  it("returns empty array for empty entries", () => {
    expect(classifyAlerts([])).toEqual([]);
  });

  it("does not produce NO_SESSIONS if sessions entry is missing entirely", () => {
    const entries: StatusEntry[] = [{ type: "task", count: 5, hasErrors: false }];
    const alerts = classifyAlerts(entries);
    const codes = alerts.map((a) => a.code);
    expect(codes).not.toContain("NO_SESSIONS");
  });

  it("alert messages are non-empty strings", () => {
    const entries: StatusEntry[] = [
      { type: "session", count: 0, hasErrors: true },
      { type: "blocked", count: 1, hasErrors: false },
    ];
    const alerts = classifyAlerts(entries);
    for (const alert of alerts) {
      expect(typeof alert.message).toBe("string");
      expect(alert.message.length).toBeGreaterThan(0);
    }
  });

  it("all alerts have valid level values", () => {
    const entries: StatusEntry[] = [
      { type: "session", count: 0, hasErrors: true },
      { type: "blocked", count: 1, hasErrors: false },
    ];
    const alerts = classifyAlerts(entries);
    const validLevels = ["info", "warning", "critical"];
    for (const alert of alerts) {
      expect(validLevels).toContain(alert.level);
    }
  });
});
