import {
  fetchApprovalsPolicy,
  fetchPendingApprovals,
  resolveApproval as resolveApprovalRequest,
  type DeckGoApprovalPolicy,
  type DeckGoApprovalPolicyDefaults,
  type DeckGoPendingApproval,
} from "@/api";
import { createLocalStore } from "./create-local-store";

export type ApprovalDecision = "allow-once" | "allow-always" | "deny";
export type PendingApproval = DeckGoPendingApproval;
export type ExecSecurity = NonNullable<DeckGoApprovalPolicyDefaults["security"]>;
export type ExecAsk = NonNullable<DeckGoApprovalPolicyDefaults["ask"]>;
export type ApprovalPolicyDefaults = DeckGoApprovalPolicyDefaults;
export type ApprovalPolicy = DeckGoApprovalPolicy;

function isExpiredPendingApproval(approval: PendingApproval, now = Date.now()): boolean {
  return Number.isFinite(approval.expiresAtMs) && approval.expiresAtMs <= now;
}

function filterActivePendingApprovals(
  approvals: PendingApproval[],
  now = Date.now(),
): PendingApproval[] {
  return approvals.filter((approval) => !isExpiredPendingApproval(approval, now));
}

export interface ApprovalsState {
  pending: PendingApproval[];
  policy: ApprovalPolicy | null;
  policyHash: string | null;
  loading: boolean;
  error: string | null;

  fetchPolicy: () => Promise<void>;
  fetchPending: () => Promise<void>;
  resolveApproval: (id: string, decision: ApprovalDecision) => Promise<boolean>;
  addPending: (approval: PendingApproval) => void;
  removePending: (id: string) => void;
}

export const useApprovalsStore = createLocalStore<ApprovalsState>((set) => ({
  pending: [],
  policy: null,
  policyHash: null,
  loading: false,
  error: null,

  fetchPolicy: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchApprovalsPolicy();
      const file = data.file ?? {};
      set({
        policy: {
          defaults: file.defaults ?? {},
          agents: file.agents ?? {},
          allowlist: file.allowlist ?? [],
        },
        policyHash: data.hash ?? null,
        loading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to fetch policy",
        loading: false,
      });
    }
  },

  fetchPending: async () => {
    try {
      const data = await fetchPendingApprovals();
      set({ pending: filterActivePendingApprovals(data.pending ?? []) });
    } catch {
      // Pending approvals are opportunistic UI state; live stream events can
      // still populate the store if this poll fails.
    }
  },

  resolveApproval: async (id, decision) => {
    try {
      await resolveApprovalRequest(id, decision);
      set((state) => ({ pending: state.pending.filter((approval) => approval.id !== id) }));
      return true;
    } catch {
      return false;
    }
  },

  addPending: (approval) =>
    set((state) => {
      if (isExpiredPendingApproval(approval)) {
        return state;
      }
      if (state.pending.some((entry) => entry.id === approval.id)) {
        return state;
      }
      return {
        pending: [...filterActivePendingApprovals(state.pending), approval],
      };
    }),

  removePending: (id) =>
    set((state) => ({
      pending: state.pending.filter((approval) => approval.id !== id),
    })),
}));
