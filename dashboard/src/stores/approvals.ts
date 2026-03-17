import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApprovalDecision = "allow-once" | "allow-always" | "deny";

export interface PendingApproval {
  id: string;
  command: string;
  commandArgv?: string[];
  agentId?: string;
  cwd?: string;
  createdAtMs: number;
  expiresAtMs: number;
}

/** Gateway ExecSecurity enumeration. */
export type ExecSecurity = "deny" | "allowlist" | "full";

/** Gateway ExecAsk enumeration. */
export type ExecAsk = "off" | "on-miss" | "always";

export interface ApprovalPolicyDefaults {
  security?: ExecSecurity;
  ask?: ExecAsk;
  askFallback?: ExecSecurity;
  autoAllowSkills?: boolean;
}

export interface ApprovalPolicy {
  defaults: ApprovalPolicyDefaults;
  agents: Record<string, ApprovalPolicyDefaults>;
  allowlist: string[];
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface ApprovalsState {
  pending: PendingApproval[];
  policy: ApprovalPolicy | null;
  policyHash: string | null;
  loading: boolean;
  error: string | null;

  fetchPolicy: () => Promise<void>;
  fetchPending: () => Promise<void>;
  resolveApproval: (id: string, decision: ApprovalDecision) => Promise<boolean>;
  updatePolicy: (policy: ApprovalPolicy) => Promise<boolean>;
  addPending: (approval: PendingApproval) => void;
  removePending: (id: string) => void;
}

export const useApprovalsStore = create<ApprovalsState>((set, get) => ({
  pending: [],
  policy: null,
  policyHash: null,
  loading: false,
  error: null,

  fetchPolicy: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/approvals/policy");
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        set({ error: body.error ?? "Failed to fetch policy", loading: false });
        return;
      }
      const data = (await res.json()) as {
        hash?: string;
        file?: {
          defaults?: ApprovalPolicyDefaults;
          agents?: Record<string, ApprovalPolicyDefaults>;
          allowlist?: string[];
        };
      };
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
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch policy",
        loading: false,
      });
    }
  },

  fetchPending: async () => {
    try {
      const res = await fetch("/api/approvals/pending");
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as { pending?: PendingApproval[] };
      set({ pending: data.pending ?? [] });
    } catch {
      // best-effort recovery
    }
  },

  resolveApproval: async (id, decision) => {
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      if (!res.ok) {
        return false;
      }
      // Optimistically remove from pending
      set((s) => ({ pending: s.pending.filter((p) => p.id !== id) }));
      return true;
    } catch {
      return false;
    }
  },

  updatePolicy: async (policy) => {
    try {
      const { policyHash } = get();
      const res = await fetch("/api/approvals/policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: {
            defaults: policy.defaults,
            agents: policy.agents,
            allowlist: policy.allowlist,
          },
          baseHash: policyHash,
        }),
      });
      if (!res.ok) {
        return false;
      }
      const data = (await res.json()) as { hash?: string };
      set({ policy, policyHash: data.hash ?? policyHash });
      return true;
    } catch {
      return false;
    }
  },

  addPending: (approval) =>
    set((s) => {
      if (s.pending.some((p) => p.id === approval.id)) {
        return s;
      }
      return { pending: [...s.pending, approval] };
    }),

  removePending: (id) => set((s) => ({ pending: s.pending.filter((p) => p.id !== id) })),
}));
