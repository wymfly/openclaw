import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActivityEventType = "tool_call" | "chat" | "status" | "agent" | "system";

export interface ActivityEvent {
  id: string;
  timestamp: number;
  type: ActivityEventType;
  agentId?: string;
  agentName?: string;
  description: string;
  details?: string;
}

interface ActivityFilters {
  agentId: string | null;
  eventType: ActivityEventType | null;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const MAX_EVENTS = 200;

interface ActivityState {
  events: ActivityEvent[];
  filters: ActivityFilters;
  loading: boolean;

  addEvent: (event: ActivityEvent) => void;
  addEvents: (events: ActivityEvent[]) => void;
  setAgentFilter: (agentId: string | null) => void;
  setTypeFilter: (type: ActivityEventType | null) => void;
  fetchRecent: () => Promise<void>;
}

export const useActivityStore = create<ActivityState>((set) => ({
  events: [],
  filters: { agentId: null, eventType: null },
  loading: false,

  addEvent: (event) =>
    set((state) => {
      // Deduplicate by id.
      if (state.events.some((e) => e.id === event.id)) {
        return state;
      }
      const updated = [event, ...state.events];
      return { events: updated.slice(0, MAX_EVENTS) };
    }),

  addEvents: (newEvents) =>
    set((state) => {
      const existingIds = new Set(state.events.map((e) => e.id));
      const unique = newEvents.filter((e) => !existingIds.has(e.id));
      if (unique.length === 0) {
        return state;
      }
      const merged = [...unique, ...state.events]
        .toSorted((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_EVENTS);
      return { events: merged };
    }),

  setAgentFilter: (agentId) => set((state) => ({ filters: { ...state.filters, agentId } })),

  setTypeFilter: (eventType) => set((state) => ({ filters: { ...state.filters, eventType } })),

  fetchRecent: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/activity?limit=100");
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as { events?: ActivityEvent[] };
      const events = data.events ?? [];
      set({ events: events.slice(0, MAX_EVENTS) });
    } catch {
      // Silently ignore — will retry via SSE.
    } finally {
      set({ loading: false });
    }
  },
}));
