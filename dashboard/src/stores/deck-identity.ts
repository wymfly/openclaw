import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IdentityPeer {
  channel: string;
  peerId: string;
}

export interface IdentityLink {
  canonical: string;
  peers: IdentityPeer[];
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface IdentityState {
  links: IdentityLink[];
  configHash: string;
  loading: boolean;
  error: string | null;
  selectedCanonical: string | null;

  fetchLinks: () => Promise<void>;
  linkPeer: (canonical: string, channel: string, peerId: string) => Promise<boolean>;
  unlinkPeer: (canonical: string, channel: string, peerId: string) => Promise<boolean>;
  selectCanonical: (canonical: string | null) => void;
}

export const useIdentityStore = create<IdentityState>((set, get) => ({
  links: [],
  configHash: "",
  loading: false,
  error: null,
  selectedCanonical: null,

  fetchLinks: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/deck/identity");
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to fetch identities" }));
        set({ error: (data as { error?: string }).error ?? "Failed to fetch identities" });
        return;
      }
      const data = await res.json();
      set({
        links: Array.isArray(data.links) ? data.links : [],
        configHash: typeof data.configHash === "string" ? data.configHash : "",
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch identities" });
    } finally {
      set({ loading: false });
    }
  },

  linkPeer: async (canonical, channel, peerId) => {
    try {
      const res = await fetch("/api/deck/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "link",
          canonical,
          channel,
          peerId,
          baseHash: get().configHash,
        }),
      });
      if (res.ok) {
        await get().fetchLinks();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  unlinkPeer: async (canonical, channel, peerId) => {
    try {
      const res = await fetch("/api/deck/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unlink",
          canonical,
          channel,
          peerId,
          baseHash: get().configHash,
        }),
      });
      if (res.ok) {
        await get().fetchLinks();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  selectCanonical: (canonical) => set({ selectedCanonical: canonical }),
}));
