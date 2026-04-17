import type { ChannelInfo } from "@/stores/channels";
import type { AccessActions, AccessDescriptor } from "./access-descriptor.types";

/**
 * Handoff inputs that `AccessPanel` forwards to the hook.
 *
 * `channel` is the snapshot the descriptor sees through `AccessLoadContext`.
 * `selectedAccountId` / `onSelectedAccountChange` carry the Status ↔ Access
 * tab handoff; `onActivateAccessTab` is the callback that switches the
 * active tab on the parent `ChannelDetail`.
 */
export interface AccessDescriptorHandoff {
  readonly channel: ChannelInfo | null;
  readonly selectedAccountId?: string;
  readonly onSelectedAccountChange?: (accountId: string) => void;
  readonly onActivateAccessTab?: () => void;
}

/**
 * PR #1 stub implementation of `useAccessDescriptorState`.
 *
 * Returns a no-op state/actions pair so that `AccessPanel` and
 * downstream consumers compile and render correctly before PR #2
 * introduces the full state-management wiring (Zustand store,
 * config snapshot, save/refresh plumbing).
 *
 * The signature matches the final PR #2 shape so this file can be
 * replaced in-place without touching consumers.
 */
export function useAccessDescriptorState<State>(
  _descriptor: AccessDescriptor<State> | null,
  _handoff: AccessDescriptorHandoff,
): { state: State | null; actions: AccessActions } {
  return {
    state: null,
    actions: {
      save: async () => false,
      refresh: async () => {
        /* no-op stub */
      },
      openAccessTab: () => {
        /* no-op stub */
      },
    },
  };
}
