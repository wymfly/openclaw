# Deck WeCom Permission Management UX Design

**Date:** 2026-04-16
**Status:** Background input only
**Scope:** Dashboard channel permission management — generic framework + WeCom first implementation

> This document preserves the original design intent, but it is no longer the authoritative execution baseline.
> Use the current execution baseline instead: [Deck WeCom Permission Management Execution Baseline](/plans/2026-04-16-deck-wecom-permission-management-plan).

## Problem Statement

WeCom's permission architecture has three layers: platform visibility (Layer 0), command authorization via DM Policy + allowFrom (Layer 2), and dynamic agent routing (Layer 3). The Deck dashboard currently supports only basic DM Policy selection — the remaining permission features are invisible to operators and require CLI configuration.

Key pain points:

1. **allowFrom editing is broken** — selecting `allowlist` policy has no follow-up UI to edit the whitelist
2. **Dynamic agent routing is invisible** — WeCom's most powerful per-user/per-group agent isolation has zero UI presence
3. **Route simulator is unused** — Gateway provides `deck.routing.simulate` but Deck doesn't expose it
4. **Permission config is scattered** — operators must navigate 4 different entry points (3 tabs + CLI)
5. **No config consistency guards** — contradictory configs (allowlist + empty list) produce no warnings
6. **No permission overview** — no way to see "what happens when user X sends a message"

## Design Constraints

1. **Dual persona**: business admins (simple operations) + technical ops (advanced configuration)
2. **Generic interfaces + WeCom implementation**: component Props are reusable; WeCom-specific features (dynamic agents) are isolated modules
3. **Hybrid information architecture**: high-frequency operations inline, strategic features in dedicated tab
4. **All 6 gaps delivered together**: features are interconnected, splitting increases integration cost

## Architecture Overview

### 5-Tab Restructure

Replace the current 4-tab layout (Status | Bindings | Settings | Analytics) with a 5-tab layout:

```
Overview | Access | Routing | Settings | Metrics
```

| Tab          | Responsibility                                           | Primary User         | Origin                 |
| ------------ | -------------------------------------------------------- | -------------------- | ---------------------- |
| **Overview** | Connection health + permission summary at a glance       | Everyone             | Refactored from Status |
| **Access**   | Who can use this channel, what permissions they have     | Business admin focus | **New**                |
| **Routing**  | Which agent handles which user/group, route verification | Both personas        | Enhanced from Bindings |
| **Settings** | Credentials, transport, retry, network, media            | Technical ops        | Slimmed from Settings  |
| **Metrics**  | Message throughput statistics                            | Everyone             | Renamed from Analytics |

### Cross-Tab Navigation

- Overview permission summary cards link to Access Tab for editing
- Overview config alerts link to the relevant tab for fixing
- Access Tab dynamic routing panel links to Routing Tab for binding details
- Routing Tab simulator results link to Access Tab when permission issues detected
- Settings Tab WeComWizard completion guides to Access Tab for permission setup

## Section 1: Overview Tab

### Layout

The Overview Tab combines connection health monitoring (from the original Status Tab) with a new permission summary and config alert system.

**Connection Section** (top): Account list with status badges, probe button, ChannelTestTool. Directly migrated from the current Status Tab with minimal changes. The per-account settings gear icon (AccountConfigDialog) is removed — DM policy editing moves to the Access Tab.

**Permission Summary Cards** (middle): One card per account, read-only, showing:

- DM Policy (badge)
- AllowFrom count + preview (first 3 entries, "+N more" overflow)
- Dynamic agent status (enabled/disabled, admin count, DM/group toggles)
- Binding count

```typescript
interface PermissionSummaryCard {
  accountId: string;
  accountName?: string;
  dmPolicy: "pairing" | "allowlist" | "open" | "disabled";
  allowFromCount: number;
  allowFromPreview: string[]; // first 3, "+N more" for overflow
  dynamicAgents: {
    enabled: boolean;
    adminUserCount: number;
    dmCreateAgent: boolean;
    groupEnabled: boolean;
  };
  bindingCount: number;
}
```

**Config Alerts** (bottom): Cross-validation alerts computed client-side from the combined config data.

### Config Alert Rules

| Condition                                           | Severity | Message                                                                                 | Links To    |
| --------------------------------------------------- | -------- | --------------------------------------------------------------------------------------- | ----------- |
| `dmPolicy=allowlist` and `allowFrom` empty          | warning  | "allowlist policy but whitelist is empty — all commands will be rejected"               | Access Tab  |
| `dmPolicy=open`                                     | info     | "All users can execute commands, no access restrictions"                                | Access Tab  |
| `dynamicAgents.enabled=true` and `adminUsers` empty | warning  | "Dynamic routing enabled but no admins set — all users get independent Agents"          | Access Tab  |
| `dynamicAgents.enabled=true` and binding count = 0  | info     | "Dynamic routing enabled, static bindings empty (dynamic routing handles all messages)" | Routing Tab |
| account `enabled=false`                             | neutral  | "Account disabled"                                                                      | —           |

### Data Sources

- `channels.status` — dmPolicy, allowFrom snapshots per account
- `config.get` — dynamicAgents.\*, routing.failClosedOnDefaultRoute
- `deck.routing.list(channel=wecom)` — binding count

## Section 2: Access Tab

The primary surface for permission management. Serves business admins for daily operations and technical ops for advanced configuration.

### Layout

Top-to-bottom: Account Switcher → DM Policy Section → Dynamic Agent Panel (WeCom-specific) → Routing Behavior Section. Each section has its own save button.

### Account Switcher

Displayed when the channel has multiple accounts; hidden for single-account channels. Switching accounts refreshes DM Policy and AllowFrom for the selected account. An "All Accounts" view shows a comparison table across accounts.

```typescript
interface AccountSwitcherProps {
  accounts: ChannelAccount[];
  selected: string;
  onSelect: (id: string) => void;
  showAllView?: boolean;
}
```

### DM Policy Section

Reuses the existing `DmPolicySelector` component. The key interaction enhancement: **AllowFromEditor conditionally expands** based on the selected policy.

Conditional display logic:

- `dmPolicy = "open"` — "All users authorized, no whitelist needed"
- `dmPolicy = "pairing"` — "Using pairing mechanism, whitelist not active"
- `dmPolicy = "allowlist"` — **expand AllowFromEditor**
- `dmPolicy = "disabled"` — "All commands disabled"

### AllowFromEditor (Generic Component)

Tag-input style editor with bulk import support.

```typescript
interface AllowFromEditorProps {
  entries: string[];
  onChange: (entries: string[]) => void;
  formatHint?: string; // e.g., "Formats: userid / user:userid / *"
  normalize?: (raw: string) => string; // WeCom: strip wecom:/user: prefix
  validate?: (entry: string) => boolean;
  placeholder?: string;
}
```

Features:

- Individual entry add/remove via tag-input
- Bulk import via dialog (textarea, one userId per line, auto-deduplicate)
- Entry count display
- Format hint text below the input
- Wildcard `*` support with visual distinction

WeCom-specific normalization: strips `wecom:`, `user:`, `userid:` prefixes, lowercases, trims.

### Dynamic Agent Panel (WeCom-Specific)

Progressive disclosure: master toggle off → collapsed one-line summary; toggle on → expanded sub-configuration.

```
OFF: "Dynamic routing disabled — all users share the default Agent"
ON:  Expand → DM toggle + Group toggle + Admin Users list
```

Sub-fields when enabled:

- **DM Independent Agent** toggle (`dmCreateAgent`) — "Create independent Agent session for each user's DM"
- **Group Independent Agent** toggle (`groupEnabled`) — "Create independent Agent session for each group chat"
- **Admin Users** list — reuses `AllowFromEditor` component with different labels/hints. Admin users always use the main Agent, bypassing dynamic routing.

### Routing Behavior Section (Generic)

Single toggle for `failClosedOnDefaultRoute`:

- OFF: "Unbound account messages fall back to default Agent"
- ON: "Unbound account messages are rejected"

### Inline Config Guards

Real-time validation banners within the Access Tab (in addition to Overview Tab alerts):

- allowlist + empty allowFrom → warning banner at top of DM Policy Section
- dynamic routing enabled + empty adminUsers → info banner at top of Dynamic Agent Panel

### Bot vs Agent DM Policy

A WeCom account can have both bot and agent modes, each with independent DM policy. The Access Tab resolves which to display:

- If account has **bot configured** → show/edit `bot.dm.policy` + `bot.dm.allowFrom`
- If account has **agent configured** → show/edit `agent.dm.policy` + `agent.dm.allowFrom`
- If account has **both** (dual mode) → show both in sub-sections with labels "Bot DM Policy" / "Agent DM Policy"
- Detection: read `ResolvedWecomAccount.bot.configured` and `ResolvedWecomAccount.agent.configured` from the account snapshot

### Data Flow

Read: `config.get` → `channels.wecom.accounts.{id}.bot.dm.*`, `channels.wecom.accounts.{id}.agent.dm.*`, `channels.wecom.dynamicAgents.*`, `channels.wecom.routing.failClosedOnDefaultRoute`

Write (per-section independent save):

```typescript
// DM Policy + AllowFrom — bot mode
config.patch({
  channels: { wecom: { accounts: { [accountId]: { bot: { dm: { policy, allowFrom } } } } } },
});

// DM Policy + AllowFrom — agent mode
config.patch({
  channels: { wecom: { accounts: { [accountId]: { agent: { dm: { policy, allowFrom } } } } } },
});

// Dynamic Agents
config.patch({
  channels: { wecom: { dynamicAgents: { enabled, dmCreateAgent, groupEnabled, adminUsers } } },
});

// Routing Behavior
config.patch({
  channels: { wecom: { routing: { failClosedOnDefaultRoute } } },
});
```

### Channel Extension Point

The Access Tab uses a registry pattern (similar to `onboarding-registry`) for channel-specific sections:

```typescript
// access/channel-access-registry.ts
type ChannelAccessExtension = {
  channelId: string;
  render: (props: { accountId: string; config: unknown }) => ReactNode;
};

const registry: ChannelAccessExtension[] = [
  { channelId: "wecom", render: (props) => <DynamicAgentPanel {...props} /> },
];
```

Generic sections (DM Policy, AllowFrom, Routing Behavior) render for all channels. Channel-specific sections render only when a matching extension is registered.

## Section 3: Routing Tab

The enhanced Bindings Tab with a new route simulator at the top and static binding rules below.

### Route Simulator

Two modes:

- **Simple mode** (business admin): userId + DM/Group toggle → simulate button
- **Advanced mode** (technical ops): expandable section with accountId, guildId, memberRoleIds

```typescript
interface SimulatorInput {
  channel: string; // fixed to current channel in embedded mode
  accountId?: string; // dropdown
  userId: string; // manual input
  peerKind: "direct" | "group";
  guildId?: string; // group mode, optional
  memberRoleIds?: string[]; // advanced, optional
}
```

### Simulator Output

Three-part result display:

**1. Conclusion** (prominent): Matched agent (AgentBadge) + match type (TierBadge)

**2. Tier Chain Table**: Visual decision path from `deck.routing.simulate` response.

- `checked=true, matched=true` → green checkmark (hit)
- `checked=true, matched=false` → gray cross (checked, no match)
- `checked=false` → gray circle (short-circuited)

**3. Permission Cross-Check** (client-side computed): Cross-references the simulated user against Access Tab configuration:

- User in allowFrom → "Commands authorized"
- User not in allowFrom (allowlist policy) → "Commands will be rejected (not in allowFrom)"
- User in adminUsers → "Admin user — always uses main Agent"

This cross-check requires no additional API call — computed from `config.get` data already loaded.

### Gateway RPC

```typescript
gw.deckRoutingSimulate({
  channel: "wecom",
  accountId: "default",
  peer: { kind: "direct", id: "zhangsan" },
});
// Returns: { agentId, matchedBy, sessionKey, tiers: [{ tier, checked, matched }] }
```

### Static Binding Rules

Migrated from the existing BindingsTab with minimal changes:

- Filter bar (channel + account selectors)
- Binding table with CRUD operations
- BindingDialog for add/edit (existing component, reused)
- DM Policy Summary card at bottom

All existing components reused: `BindingDialog`, `TierBadge`, `AgentBadge`.

## Section 4: Settings Tab (Slimmed)

DM Policy-related content moves to Access Tab. Settings retains only technical configuration.

### Retained Content

- WeComWizard button (existing) — Step 3 (DM Policy) adds guidance text: "Detailed permission settings available in the Access tab"
- Schema-driven form (existing `ChannelSchemaSettings`) with field filtering: excludes `bot.dm.*`, `agent.dm.*`, `dynamicAgents.*`, `routing.failClosedOnDefaultRoute`
- Legacy fallback panel (existing `ChannelLegacySettingsPanel`) with DmPolicySelector removed — retains only RetryStrategyEditor
- Wizard completion redirects to Access Tab: "Credentials configured. Go to Access tab to set up permissions?"

### Schema Field Filtering

When `ChannelSchemaSettings` renders for a channel that has an Access Tab, it must exclude access-related fields to avoid duplication. Implementation: a `excludePaths` prop passed to `SchemaForm` that skips fields whose dotted key starts with any excluded prefix.

```typescript
const ACCESS_FIELD_PREFIXES = [
  "bot.dm.",           // DM policy — in Access Tab
  "agent.dm.",         // Agent DM policy — in Access Tab
  "dynamicAgents.",    // Dynamic routing — in Access Tab
  "routing.",          // Routing behavior — in Access Tab
];

// SchemaForm skips any field where key.startsWith(prefix) for any prefix
<ChannelSchemaSettings excludePaths={ACCESS_FIELD_PREFIXES} ... />
```

### Rendering Strategy

```
hasOnboardingDescriptor → Wizard button + filtered SchemaForm
hasSchema              → Full SchemaForm (minus access fields via excludePaths)
else                   → Legacy panel (RetryStrategyEditor only)
```

## Section 5: Metrics Tab

Renamed from Analytics. Content unchanged — `ChannelAnalytics` component is reused with only the tab label i18n key updated.

## Component Architecture

### File Structure

```
dashboard/src/components/panels/channels/
├── ChannelDetail.tsx                  (refactor: 5 tabs)
├── tabs/
│   ├── OverviewTab.tsx                generic
│   ├── AccessTab.tsx                  generic shell + channel slot
│   ├── RoutingTab.tsx                 generic
│   ├── SettingsTab.tsx                generic (renamed from ChannelSettingsTab)
│   └── MetricsTab.tsx                 generic (wraps ChannelAnalytics)
│
├── access/                            NEW directory
│   ├── AccountSwitcher.tsx            generic
│   ├── AllowFromEditor.tsx            generic
│   ├── BulkImportDialog.tsx           generic
│   ├── DmPolicySection.tsx            generic
│   ├── RoutingBehaviorSection.tsx     generic
│   ├── DynamicAgentPanel.tsx          WeCom-specific
│   └── channel-access-registry.ts     extension point registry
│
├── routing/                           NEW directory
│   ├── RouteSimulator.tsx             generic
│   ├── SimulatorInput.tsx             generic
│   ├── SimulatorResult.tsx            generic
│   ├── TierChainTable.tsx             generic
│   ├── PermissionCrossCheck.tsx       generic
│   └── BindingList.tsx                generic (extracted from BindingsTab)
│
├── overview/                          NEW directory
│   ├── ConnectionSection.tsx          generic (extracted from ChannelDetail)
│   ├── PermissionSummaryCards.tsx     generic
│   ├── PermissionSummaryCard.tsx      generic
│   └── ConfigAlerts.tsx               generic
│
├── shared/
│   └── ConfigAlertBanner.tsx          generic (new)
│
├── WeComWizard.tsx                    retained (minor tweaks)
├── DmPolicySelector.tsx               retained (unchanged)
├── RetryStrategyEditor.tsx            retained (unchanged)
└── onboarding-registry.tsx            retained (unchanged)
```

### Generic vs WeCom-Specific Summary

| Component              | Type               | Reusable By                     |
| ---------------------- | ------------------ | ------------------------------- |
| AccountSwitcher        | Generic            | Any multi-account channel       |
| AllowFromEditor        | Generic            | Any channel with allowFrom      |
| BulkImportDialog       | Generic            | Any list-editing scenario       |
| DmPolicySection        | Generic            | Any channel with DM policy      |
| RouteSimulator         | Generic            | All channels (uses generic RPC) |
| PermissionCrossCheck   | Generic            | All channels                    |
| ConfigAlertBanner      | Generic            | Any config validation           |
| RoutingBehaviorSection | Generic            | Any channel with routing config |
| DynamicAgentPanel      | **WeCom-specific** | WeCom only (via registry)       |

### Store Layer Changes

**channels store** (`stores/channels.ts`) — new fields:

```typescript
interface ChannelsStoreState {
  // existing fields ...
  channelAccessConfig: Map<string, ChannelAccessConfig>;
  fetchAccessConfig: (channelId: string) => Promise<void>;
  updateDmPolicy: (
    channelId: string,
    accountId: string,
    policy: string,
    allowFrom?: string[],
  ) => Promise<void>;
  updateDynamicAgents: (channelId: string, config: DynamicAgentsConfig) => Promise<void>;
  updateRoutingBehavior: (channelId: string, failClosed: boolean) => Promise<void>;
}

interface ChannelAccessConfig {
  accounts: Map<string, AccountAccessConfig>;
  dynamicAgents: DynamicAgentsConfig;
  failClosedOnDefaultRoute: boolean;
}

interface AccountAccessConfig {
  dmPolicy: string;
  allowFrom: string[];
}

interface DynamicAgentsConfig {
  enabled: boolean;
  dmCreateAgent: boolean;
  groupEnabled: boolean;
  adminUsers: string[];
}
```

**deck-routing store** (`stores/deck-routing.ts`) — new simulate fields:

```typescript
interface DeckRoutingStoreState {
  // existing fields ...
  simulateResult: SimulateResult | null;
  simulating: boolean;
  simulateRoute: (input: SimulateInput) => Promise<void>;
}
```

### API Routes

New:

- `dashboard/src/app/api/channels/[channelId]/access/route.ts` — read/write Access configuration
- `dashboard/src/app/api/deck/routing/simulate/route.ts` — route simulation proxy

### Gateway Allowlist Addition

```typescript
// gateway-allowlist.ts — add:
"deck.routing.simulate";
```

`config.get` and `config.patch` are already in the allowlist.

## i18n Keys

New namespace additions under `channels`:

```
channels.tabs.overview / access / routing / settings / metrics
channels.access.accountSwitcher.*
channels.access.dmPolicy.* (reuse existing channels.settings.dmPolicy.*)
channels.access.allowFrom.title / count / add / bulkImport / formatHint / empty / wildcard
channels.access.dynamicAgents.title / enabled / disabled / dmCreate / groupCreate / adminUsers / noAdmin
channels.access.routingBehavior.title / failClosed / failOpen
channels.access.alerts.*
channels.overview.permissionSummary.*
channels.overview.configAlerts.*
channels.routing.simulator.title / userId / peerKind / simulate / result / tierChain / crossCheck
channels.routing.simulator.advanced / guildId / roles
```

Both `zh.json` and `en.json` must be updated synchronously per dashboard CLAUDE.md rules.

## Removed / Refactored Components

| Component                                               | Action                                                    | Reason                                |
| ------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------- |
| `AccountConfigDialog.tsx`                               | Remove                                                    | DM policy editing moves to Access Tab |
| `ChannelLegacySettingsPanel.tsx` DmPolicySelector usage | Remove from here                                          | Moves to Access Tab                   |
| `BindingsTab.tsx`                                       | Extract into `BindingList.tsx` + wrap in `RoutingTab.tsx` | Tab restructure                       |
| `ChannelDetail.tsx` Status tab content                  | Extract into `OverviewTab.tsx`                            | Tab restructure                       |

## Testing Strategy

- Unit tests for `AllowFromEditor` (add/remove/normalize/bulk-import/wildcard)
- Unit tests for config alert rules (cross-validation logic)
- Unit tests for `PermissionCrossCheck` (allowFrom/adminUsers matching)
- Integration test for `RouteSimulator` (mock `deck.routing.simulate` response, verify tier chain rendering)
- Existing `BindingDialog` and routing store tests remain valid with path updates
