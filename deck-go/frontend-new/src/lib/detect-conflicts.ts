import type { DeckGoRoutingMatch } from "../api";

type LooseMatch = Partial<Omit<DeckGoRoutingMatch, "peer">> & {
  peer?: { kind: string; id: string };
};

export type ConflictBinding = {
  id: string;
  match: LooseMatch;
  tier: string;
  agentId: string;
};

export type ConflictPair = {
  bindingA: string;
  bindingB: string;
  overlapType: "exact" | "subset";
};

function peersOverlap(
  left: { kind: string; id: string } | undefined,
  right: { kind: string; id: string } | undefined,
) {
  if (!left || !right) {
    return true;
  }
  return left.kind === right.kind && left.id === right.id;
}

function rolesOverlap(left: string[] | undefined, right: string[] | undefined) {
  if (!left || !right) {
    return true;
  }
  const rightRoles = new Set(right);
  return left.some((role) => rightRoles.has(role));
}

function classifyOverlap(left: LooseMatch, right: LooseMatch): ConflictPair["overlapType"] | null {
  if (left.channel && right.channel && left.channel !== right.channel) {
    return null;
  }
  if (left.accountId && right.accountId && left.accountId !== right.accountId) {
    return null;
  }
  if (left.teamId && right.teamId && left.teamId !== right.teamId) {
    return null;
  }
  if (left.guildId && right.guildId && left.guildId !== right.guildId) {
    return null;
  }
  if (!peersOverlap(left.peer, right.peer)) {
    return null;
  }
  if (!rolesOverlap(left.roles, right.roles)) {
    return null;
  }
  return Object.keys(left).length === Object.keys(right).length ? "exact" : "subset";
}

export function detectConflicts(bindings: ConflictBinding[]) {
  const results: ConflictPair[] = [];

  for (let leftIndex = 0; leftIndex < bindings.length; leftIndex += 1) {
    const left = bindings[leftIndex];
    if (left.tier === "default") {
      continue;
    }

    for (let rightIndex = leftIndex + 1; rightIndex < bindings.length; rightIndex += 1) {
      const right = bindings[rightIndex];
      if (right.tier === "default" || left.agentId === right.agentId) {
        continue;
      }

      const overlapType = classifyOverlap(left.match, right.match);
      if (overlapType) {
        results.push({ bindingA: left.id, bindingB: right.id, overlapType });
      }
    }
  }

  return results;
}
