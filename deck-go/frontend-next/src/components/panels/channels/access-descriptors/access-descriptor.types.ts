import type { ReactNode } from "react";
import type { ChannelInfo } from "@/stores/channels";
import type { GatewayClient } from "@/types/gateway-client.generated";

/**
 * Context passed into {@link AccessDescriptor.load}.
 *
 * DI container for descriptor loaders. Avoids descriptors importing global
 * stores directly so they remain sandboxable and testable.
 */
export interface AccessLoadContext {
  readonly channelId: string;

  /**
   * Typed Gateway client.
   *
   * **Target state:** mandatory per project-wide rule "Deck 必须通过 typed client
   * (`gw.*`) 调用 Gateway，禁止字符串形式的 Gateway 调用" (see root
   * `CLAUDE.md`).
   *
   * **Current state:** optional, because Deck has no `useGatewayClient()`
   * hook yet (grep confirmed zero callsites on 2026-04-17). The WeCom descriptor
   * returns `null` from `load()` and does not consume `gw`. The first descriptor
   * that needs server-driven state will introduce the `useGatewayClient()`
   * infrastructure and tighten `gw` back to required in a follow-up spec.
   */
  readonly gw?: GatewayClient;

  /** ChannelInfo snapshot; null if the channel is schema-only (not configured yet). */
  readonly channel: ChannelInfo | null;

  /** Raw channel config (e.g. openclaw.json entry). null until fetchChannelConfig resolves. */
  readonly configSnapshot?: Record<string, unknown> | null;
}

/**
 * Mutation and navigation handlers that Deck provides to descriptors.
 *
 * Descriptors never touch global stores directly; they invoke these actions
 * and Deck wires them to the appropriate subsystem (Zustand store, router, etc.).
 */
export interface AccessActions {
  /** Save a config patch scoped to this channel. Returns true on success. */
  readonly save: (patch: Record<string, unknown>) => Promise<boolean>;

  /** Re-fetch channel config / bindings / health. */
  readonly refresh: () => Promise<void>;

  /**
   * Navigate to the Access tab with optional accountId preselection.
   *
   * MUST perform BOTH operations atomically:
   *   1. Preselect the account (via `onSelectedAccountChange`) when `accountId` is provided.
   *   2. Activate the Access tab itself (via `onActivateAccessTab`).
   *
   * Replaces the former inline `setAccessAccountId(...); setActiveTab("access");`
   * pair at `ChannelDetail.tsx:799-800`. Both calls must happen to keep
   * `ChannelDetail.access-handoff.test.tsx` green.
   */
  readonly openAccessTab: (accountId?: string) => void;
}

/**
 * Render-time context that Deck passes into descriptor UI entrypoints.
 *
 * This keeps state, mutations, channel snapshot, and Status -> Access handoff
 * data on one formal contract path instead of splitting them between the
 * descriptor interface and outer consumer closures.
 */
export interface AccessRenderContext<State = unknown> {
  /** Stable channel id (matches Gateway channelId). */
  readonly channelId: string;

  /** ChannelInfo snapshot; null if the channel is schema-only (not configured yet). */
  readonly channel: ChannelInfo | null;

  /** Loaded descriptor state; opaque to callers. */
  readonly state: State | null;

  /** Deck-provided mutation + navigation handlers. */
  readonly actions: AccessActions;

  /** Optional account handoff for Status -> Access flows. */
  readonly selectedAccountId?: string;

  /** Optional controlled-mode updater for account handoff. */
  readonly onSelectedAccountChange?: (accountId: string) => void;
}

/**
 * Access control descriptor for a channel.
 *
 * Contract principle: the registry only governs HOW to mount access UI.
 * The state shape is opaque to the registry and fully owned by the implementing
 * descriptor. Different channels may have radically different access models
 * (allow-lists, role-based, group filters, etc.) without contract changes.
 *
 * @template State Channel-specific access state. Opaque to the registry.
 */
export interface AccessDescriptor<State = unknown> {
  /** Stable channel id (matches Gateway channelId). */
  readonly channelId: string;

  /**
   * Load the current access state for this channel.
   *
   * Receives DI context with an optional typed Gateway client, channel info,
   * and config snapshot. May return null if loading is handled entirely inside
   * the render subtree (e.g. WeCom, which preserves Zustand store direct-access
   * in its children).
   */
  load(context: AccessLoadContext): Promise<State | null>;

  /**
   * Render the Access tab UI for this channel.
   *
   * MUST return a real ReactNode — descriptor implementations are not allowed
   * to return null. Returning null is reserved for the `AccessPanel` layer
   * when no descriptor is registered for the channel.
   */
  render(context: AccessRenderContext<State>): ReactNode;

  /**
   * Optional: normalize a raw config snapshot into the State shape.
   * Useful for channels that derive State from `openclaw.json` entries.
   */
  normalize?(raw: unknown): State;

  /**
   * Optional: render the permission summary section on the Status tab.
   *
   * Consumed by `ChannelDetail.tsx` to replace the hard-coded wecom summary.
   * Returning null hides the summary slot for this channel.
   */
  renderStatusSummary?(context: AccessRenderContext<State>): ReactNode;

  /**
   * Optional: config field paths that the Settings tab should NOT render
   * (because they are managed in the Access tab instead).
   *
   * Replaces the hard-coded `WECOM_ACCESS_EXCLUDE_PATHS` that previously
   * lived in `ChannelSettingsTab.tsx`.
   */
  readonly settingsExcludePaths?: readonly string[];

  /**
   * Optional: handle "Manage Access" button click from the Status tab.
   *
   * Default (when absent): do nothing; Deck falls back to the generic
   * `AccountConfigDialog`.
   *
   * Implementations MUST rely on `actions.openAccessTab` to handle both the
   * accountId preselection AND the tab switch atomically
   * (see {@link AccessActions.openAccessTab}).
   */
  handleManageAccess?(accountId: string, actions: AccessActions): void;

  /**
   * Optional: whether this channel manages per-account configuration inside
   * the Access tab (and thus should NOT render the fallback `AccountConfigDialog`).
   *
   * Replaces the hard-coded `channelId !== "wecom"` gate on
   * `ChannelDetail.tsx:910`. Undefined defaults to false (descriptor-less
   * channels and descriptors that want the dialog both get the dialog).
   */
  readonly usesAccessTabForAccountConfig?: boolean;
}
