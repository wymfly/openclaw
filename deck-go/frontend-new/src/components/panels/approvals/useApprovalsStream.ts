import { useCallback, type Dispatch, type SetStateAction } from "react";
import type {
  DeckGoPendingApproval,
  DeckGoPendingApprovalsResponse,
  DeckGoServerEvent,
} from "@/api-types";
import { useApprovalQueueProjectionSubscription } from "../../../data/modules/approvals";

function filterActivePendingApprovals(approvals: DeckGoPendingApproval[], now = Date.now()) {
  return approvals.filter(
    (approval) => !Number.isFinite(approval.expiresAtMs) || approval.expiresAtMs > now,
  );
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readStreamPayload(event: DeckGoServerEvent): Record<string, unknown> | null {
  const jsonPayload = readRecord(event.json);
  if (jsonPayload) {
    return jsonPayload;
  }
  if (!event.data) {
    return null;
  }
  try {
    return readRecord(JSON.parse(event.data));
  } catch {
    return null;
  }
}

function readPendingApproval(event: DeckGoServerEvent): DeckGoPendingApproval | null {
  const payload = readStreamPayload(event);
  if (!payload) {
    return null;
  }
  const { id, command, createdAtMs, expiresAtMs } = payload;
  if (
    typeof id !== "string" ||
    !id.trim() ||
    typeof command !== "string" ||
    typeof createdAtMs !== "number" ||
    typeof expiresAtMs !== "number"
  ) {
    return null;
  }
  return {
    id,
    command,
    commandArgv: Array.isArray(payload.commandArgv)
      ? payload.commandArgv.filter((item): item is string => typeof item === "string")
      : undefined,
    agentId: typeof payload.agentId === "string" ? payload.agentId : undefined,
    sessionKey: typeof payload.sessionKey === "string" ? payload.sessionKey : undefined,
    runId: typeof payload.runId === "string" ? payload.runId : undefined,
    cwd: typeof payload.cwd === "string" ? payload.cwd : undefined,
    createdAtMs,
    expiresAtMs,
  };
}

function readResolvedApprovalId(event: DeckGoServerEvent): string | null {
  const payload = readStreamPayload(event);
  const id = payload?.id;
  return typeof id === "string" && id.trim() ? id : null;
}

function addPendingApproval(
  response: DeckGoPendingApprovalsResponse | null,
  approval: DeckGoPendingApproval,
): DeckGoPendingApprovalsResponse | null {
  if (filterActivePendingApprovals([approval]).length === 0) {
    return response;
  }
  const pending = filterActivePendingApprovals(response?.pending ?? []);
  if (pending.some((entry) => entry.id === approval.id)) {
    return response ? { ...response, pending } : { pending };
  }
  return {
    ...response,
    pending: [...pending, approval],
  };
}

function removePendingApproval(
  response: DeckGoPendingApprovalsResponse | null,
  id: string,
): DeckGoPendingApprovalsResponse | null {
  if (!response) {
    return response;
  }
  return {
    ...response,
    pending: (response.pending ?? []).filter((approval) => approval.id !== id),
  };
}

export function useApprovalsStream({
  setPendingResponse,
  setSelectedApprovalId,
}: {
  setPendingResponse: Dispatch<SetStateAction<DeckGoPendingApprovalsResponse | null>>;
  setSelectedApprovalId: Dispatch<SetStateAction<string>>;
}) {
  const handleEvent = useCallback(
    (event: DeckGoServerEvent) => {
      if (event.event === "approval.pending") {
        const approval = readPendingApproval(event);
        if (!approval) {
          return;
        }
        setPendingResponse((current) => addPendingApproval(current, approval));
        setSelectedApprovalId((current) => current || approval.id);
        return;
      }
      if (event.event === "approval.resolved") {
        const id = readResolvedApprovalId(event);
        if (!id) {
          return;
        }
        setPendingResponse((current) => removePendingApproval(current, id));
        setSelectedApprovalId((current) => (current === id ? "" : current));
      }
    },
    [setPendingResponse, setSelectedApprovalId],
  );

  useApprovalQueueProjectionSubscription({
    retryDelayMs: 1_000,
    onEvent: handleEvent,
  });
}
