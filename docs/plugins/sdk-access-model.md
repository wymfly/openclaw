# Access Descriptor SDK — Channel Access UI Contract

The access descriptor contract lets a channel plug its own permission-management UI
into the Deck dashboard without Deck having to hard-code `channelId === "..."` branches.
The first consumer is WeCom; the contract is designed to accommodate allow-lists,
role-based controls, group filters, and other access models future channels may need.

## Why a descriptor contract (vs. Schema-only / Remote Component)

- **Schema-only** (JSON Schema for config) cannot express interactive surfaces like
  multi-step forms, warnings that depend on bindings, or section-level save buttons.
- **Remote Component / micro-frontend** (L3) has a much larger attack surface,
  deployment complexity, and debugging cost — excessive for the current need.
- **Descriptor contract** (L2) gives each channel a typed entry point with a small,
  opaque state shape. The Deck core stays extension-agnostic; new channels register
  a descriptor instead of editing Deck internals.

## Contract Members

A descriptor implements the `AccessDescriptor<State>` interface
(`dashboard/src/components/panels/channels/access-descriptors/access-descriptor.types.ts`).
It has 3 required and 5 optional members.

### Required

| Member                                    | Purpose                                                                                                                                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `channelId: string`                       | Stable id that matches the Gateway channelId.                                                                                                                                                         |
| `load(context) => Promise<State \| null>` | Load the access state. May return `null` when data flow stays inside the render subtree (e.g. WeCom preserves Zustand store access in children).                                                      |
| `render(state, actions) => ReactNode`     | Render the Access tab UI. **MUST return a real ReactNode — descriptors are not allowed to return `null`.** Returning `null` is reserved for the `AccessPanel` layer when no descriptor is registered. |

### Optional

| Member                                             | Purpose                                                                                                                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `normalize(raw) => State`                          | Normalize a raw `openclaw.json` config snapshot into the descriptor's State shape.                                                                                               |
| `renderStatusSummary(state, actions) => ReactNode` | Render the permission summary section on the Status tab. Return `null` to hide the slot for this channel.                                                                        |
| `settingsExcludePaths: readonly string[]`          | Config field paths that the Settings tab should NOT render (because they are managed in the Access tab instead).                                                                 |
| `handleManageAccess(accountId, actions)`           | Handle "Manage Access" clicks from the Status tab. Implementations MUST rely on `actions.openAccessTab` to perform account preselection + tab switch atomically.                 |
| `usesAccessTabForAccountConfig: boolean`           | Whether this channel manages per-account configuration inside the Access tab (and thus should NOT render the generic `AccountConfigDialog`). Defaults to `false` when undefined. |

## `AccessLoadContext`

DI context passed to `descriptor.load()`:

```typescript
interface AccessLoadContext {
  readonly channelId: string;
  readonly gw?: GatewayClient; // see note below
  readonly channel: ChannelInfo | null;
  readonly configSnapshot?: Record<string, unknown> | null;
}
```

### `gw` — current status

`gw` is **optional** today because Deck has no `useGatewayClient()` hook yet
(grep confirmed zero callsites on 2026-04-17). The WeCom descriptor returns `null`
from `load()` and does not consume `gw`.

**Target state:** `gw` becomes mandatory per the project-wide rule "Deck 必须通过
typed client (`gw.*`) 调用 Gateway，禁止 `gatewayRequest()` 字符串调用"
(see root `CLAUDE.md`). The first descriptor that needs server-driven state
will introduce the `useGatewayClient()` infrastructure and tighten `gw`
back to required in a follow-up spec.

## `AccessActions`

Mutation and navigation handlers Deck provides to descriptors:

```typescript
interface AccessActions {
  save: (patch: Record<string, unknown>) => Promise<boolean>;
  refresh: () => Promise<void>;
  openAccessTab: (accountId?: string) => void;
}
```

`openAccessTab` MUST perform both operations atomically:

1. Preselect the account (via the Deck-provided `onSelectedAccountChange`) when `accountId` is given.
2. Activate the Access tab itself (via the Deck-provided `onActivateAccessTab`).

Both calls are required to keep `ChannelDetail.access-handoff.test.tsx` green.

## Minimal example

```typescript
// placeholder-access-descriptor.tsx
import type { AccessDescriptor } from "./access-descriptor.types";
import { registerAccessDescriptor } from "./access-descriptor-registry";

export const placeholderAccessDescriptor: AccessDescriptor<null> = {
  channelId: "placeholder",
  async load() {
    return null;
  },
  render() {
    return <p>Placeholder access control UI</p>;
  },
};

// Register on module load; the top-level providers file must
// side-effect import the access-descriptors barrel so this runs.
registerAccessDescriptor(placeholderAccessDescriptor as AccessDescriptor<unknown>);
```

## Registration flow

1. Descriptor file ends with `registerAccessDescriptor(myDescriptor, options?)`.
2. `access-descriptors/index.ts` imports each descriptor as a side-effect:
   `import "./placeholder-access-descriptor";`.
3. Deck's top-level providers file (`dashboard/src/app/providers.tsx` or equivalent)
   imports the barrel once at startup:
   `import "@/components/panels/channels/access-descriptors";`.

In development (`process.env.NODE_ENV !== "production"`), descriptors may be
registered with `{ allowReplace: true }` so Next.js's HMR does not throw on
module re-evaluation. Production always runs with strict registration.

## Safety

- **Do not** return `null` from `render`. `null` is reserved for the
  `AccessPanel` layer when no descriptor is registered; descriptor implementations
  must return a real ReactNode.
- Descriptors should avoid importing global stores (Zustand) directly; prefer the
  `actions` callbacks so Deck can inject test mocks and sandboxes. WeCom is a
  transitional exception — its child components retain store direct-access; new
  descriptors should not copy this pattern.
- Descriptors must be side-effect registered through the barrel, not lazily
  imported on first use. Lazy registration breaks the "registered before consumer
  mounts" invariant and can result in an unsupported-channel fallback being shown
  briefly.

## Related files

- Contract types: `dashboard/src/components/panels/channels/access-descriptors/access-descriptor.types.ts`
- Registry: `dashboard/src/components/panels/channels/access-descriptors/access-descriptor-registry.ts`
- AccessPanel (consumer): `dashboard/src/components/panels/channels/access-descriptors/AccessPanel.tsx`
- Hooks (state/actions): `dashboard/src/components/panels/channels/access-descriptors/hooks.ts`
- Spec: `docs/superpowers/specs/2026-04-17-deck-access-model-contract-design.md`
- Plan: `docs/superpowers/plans/2026-04-17-deck-access-model-contract-plan.md`
