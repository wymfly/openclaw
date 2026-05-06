import {
  deckGoMutationEvidenceContract,
  type DeckGoMutationAction,
  type DeckGoMutationActionId,
} from "../../../contracts/generated/ts/deck-mutations.generated";

type Jsonish = Record<string, unknown>;

export type MutationEvidence = {
  actionId: DeckGoMutationActionId;
  auditCoverage: DeckGoMutationAction["auditCoverage"]["mode"];
  conflictBehavior: DeckGoMutationAction["conflictBehavior"];
  fixtureSafety: DeckGoMutationAction["fixtureSafety"]["status"];
  ok: boolean;
  targetId?: string;
};

export type MutationErrorEvidence = {
  actionId: DeckGoMutationActionId;
  conflict: boolean;
  conflictBehavior: DeckGoMutationAction["conflictBehavior"];
  message: string;
};

export function getMutationActionContract(id: DeckGoMutationActionId): DeckGoMutationAction {
  const action = deckGoMutationEvidenceContract.actions.find((item) => item.id === id);
  if (!action) {
    throw new Error(`unknown mutation evidence action: ${id}`);
  }
  return action;
}

function valueAtPath(value: unknown, fieldPath: string): unknown {
  let cursor = value;
  for (const part of fieldPath.split(".")) {
    if (cursor === null || typeof cursor !== "object" || !(part in cursor)) {
      return undefined;
    }
    cursor = (cursor as Jsonish)[part];
  }
  return cursor;
}

function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

function isSuccessful(action: DeckGoMutationAction, response: unknown): boolean {
  const value = valueAtPath(response, action.successIndicator.path);
  if (action.successIndicator.expected === "present") {
    return isPresent(value);
  }
  return value === action.successIndicator.expected;
}

function targetId(
  action: DeckGoMutationAction,
  response: unknown,
  routeParams?: Record<string, string>,
) {
  const source =
    action.targetId.source === "route"
      ? routeParams?.[action.targetId.path]
      : valueAtPath(response, action.targetId.path);
  return typeof source === "string" && source.trim() ? source.trim() : undefined;
}

export function mutationEvidenceForResponse(
  id: DeckGoMutationActionId,
  response: unknown,
  options?: { routeParams?: Record<string, string> },
): MutationEvidence {
  const action = getMutationActionContract(id);
  return {
    actionId: action.id,
    auditCoverage: action.auditCoverage.mode,
    conflictBehavior: action.conflictBehavior,
    fixtureSafety: action.fixtureSafety.status,
    ok: isSuccessful(action, response),
    targetId: targetId(action, response, options?.routeParams),
  };
}

export function acknowledgeMutationResponse<T>(
  id: DeckGoMutationActionId,
  response: T,
  options?: { routeParams?: Record<string, string> },
): T {
  mutationEvidenceForResponse(id, response, options);
  return response;
}

export function mutationErrorEvidence(
  id: DeckGoMutationActionId,
  error: unknown,
): MutationErrorEvidence {
  const action = getMutationActionContract(id);
  let message = "";
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else if (error !== undefined && error !== null) {
    try {
      message = JSON.stringify(error) ?? "";
    } catch {
      message = "unknown mutation error";
    }
  }
  const conflictBehavior = action.conflictBehavior;
  const canConflict =
    conflictBehavior === "config-write-safety" || conflictBehavior === "upstream-preserved";
  return {
    actionId: action.id,
    conflict: canConflict && /\b(conflict|stale|hash|version)\b/i.test(message),
    conflictBehavior: action.conflictBehavior,
    message,
  };
}
