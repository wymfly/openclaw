import type { BindingMatch } from "@/stores/deck-routing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Match shape that also accepts empty objects (default-tier bindings). */
interface LooseMatch extends Partial<BindingMatch> {}

/** A binding entry fed into the conflict detector. */
export interface ConflictBinding {
  id: string;
  match: LooseMatch;
  tier: string;
  agentId: string;
}

export interface ConflictPair {
  bindingA: string;
  bindingB: string;
  overlapType: "exact" | "subset";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check whether two peer selectors overlap. */
function peersOverlap(
  a: { kind: string; id: string } | undefined,
  b: { kind: string; id: string } | undefined,
): boolean {
  // If either is unset, the unset side is a wildcard → overlap possible
  if (!a || !b) {
    return true;
  }
  return a.kind === b.kind && a.id === b.id;
}

/** Check whether two string-array role selectors have any intersection. */
function rolesOverlap(a: string[] | undefined, b: string[] | undefined): boolean {
  if (!a || !b) {
    return true;
  }
  const setB = new Set(b);
  return a.some((r) => setB.has(r));
}

/** Determine the overlap relationship between two match objects. */
function classifyOverlap(a: LooseMatch, b: LooseMatch): "exact" | "subset" | null {
  // Channel: if both specified and different → no overlap
  if (a.channel && b.channel && a.channel !== b.channel) {
    return null;
  }

  // AccountId
  if (a.accountId && b.accountId && a.accountId !== b.accountId) {
    return null;
  }

  // TeamId
  if (a.teamId && b.teamId && a.teamId !== b.teamId) {
    return null;
  }

  // GuildId
  if (a.guildId && b.guildId && a.guildId !== b.guildId) {
    return null;
  }

  // Peer
  if (!peersOverlap(a.peer, b.peer)) {
    return null;
  }

  // Roles
  if (!rolesOverlap(a.roles, b.roles)) {
    return null;
  }

  // Determine exact vs subset:
  // exact = both sides specify the same dimensions with the same values
  // subset = one side is strictly broader (fewer constraints)
  const aKeys = Object.keys(a).length;
  const bKeys = Object.keys(b).length;
  if (aKeys === bKeys) {
    return "exact";
  }
  return "subset";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * O(n²) scan over bindings to find pairs that could match the same message
 * but route to different agents (= a conflict).
 *
 * Skips:
 * - pairs routed to the same agent (same agentId)
 * - bindings in the "default" tier (catch-all, never conflicts)
 */
export function detectConflicts(bindings: ConflictBinding[]): ConflictPair[] {
  const results: ConflictPair[] = [];
  const len = bindings.length;

  for (let i = 0; i < len; i++) {
    const bi = bindings[i];
    // Default tier is the catch-all; it never conflicts
    if (bi.tier === "default") {
      continue;
    }

    for (let j = i + 1; j < len; j++) {
      const bj = bindings[j];
      if (bj.tier === "default") {
        continue;
      }

      // Same agent → not a conflict
      if (bi.agentId === bj.agentId) {
        continue;
      }

      const overlap = classifyOverlap(bi.match, bj.match);
      if (overlap) {
        results.push({ bindingA: bi.id, bindingB: bj.id, overlapType: overlap });
      }
    }
  }

  return results;
}
