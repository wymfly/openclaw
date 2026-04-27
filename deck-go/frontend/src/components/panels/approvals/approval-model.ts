import type { DeckGoPluginApprovalEntry } from "../../../api";

export function isPluginApprovalExpired(approval: DeckGoPluginApprovalEntry, now = Date.now()) {
  return Number.isFinite(approval.expiresAtMs) && Number(approval.expiresAtMs) <= now;
}

export function formatOptionalDate(value: number | undefined, fallback = "n/a") {
  return Number.isFinite(value) ? new Date(Number(value)).toLocaleString() : fallback;
}
