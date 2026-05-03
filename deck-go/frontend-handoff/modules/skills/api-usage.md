# skills — API usage

> Endpoint truth and DTO shapes are tracked in
> `deck-go/contracts/source/deck-api.contract.ts` and
> `deck-go/contracts/source/deck-endpoints.contract.json`.

## Source of truth

The skills module consumes Deck BFF skill contracts. The browser never calls Gateway directly.
Skills supports mutation (install / configure / disable), unlike plugins which is read-only.

## Deck-facing API

### `GET /api/deck/skills`

Wrapper: `fetchSkills()`. Response: `DeckGoSkillsResponse` with `skills?: DeckGoSkillEntry[]`.

This is the installed inventory. Each entry carries `key`, `name`, `status`, `source`,
`enabled`, `config`, `missingRequirements`, `installOptions`, `primaryEnv`, etc.

### `PATCH /api/deck/skills/<key>`

Wrapper: `patchSkill(key, partial)`. Response: `DeckGoSkillUpdateResponse` (`ok`, `config`).

Mutates the skill's config slice. The Configure dialog uses this. Server validates against
schema if present; otherwise accepts any JSON-encodable map.

### Hub endpoints

The hub is a separate index that the BFF proxies. Skills can be installed FROM the hub, and the
inventory then surfaces them as `source: "managed"`.

### `GET /api/deck/skills/hub/search?q=<text>`

Wrapper: `searchHub(query)`. Response: `DeckGoSkillHubSearchResponse` with
`results?: DeckGoSkillHubSearchResult[]`.

### `GET /api/deck/skills/hub/<slug>`

Wrapper: `fetchHubDetail(slug)`. Response: `DeckGoSkillHubDetailResponse`.

Provides `skill` (display info), `latestVersion`, `metadata` (os / systems requirements),
`owner`. Used by the Install wizard and the Preview action.

### `GET /api/deck/skills/hub/<slug>/bins`

Wrapper: `fetchHubBins(slug)`. Response: `DeckGoSkillHubBinsResponse` with `bins: string[]`.

### `POST /api/deck/skills/hub/<slug>/install`

Wrapper: `installFromHub(slug, optionId)`. Response: `DeckGoSkillHubMutationResponse`
(`ok`, `message`, `error`). The Install wizard drives this; on `ok=true` the inventory should
re-fetch.

### `POST /api/deck/skills/<key>/disable` and `/enable`

Wrapper: `disableSkill(key)` / `enableSkill(key)`. Response: `DeckGoSkillHubMutationResponse`.
Disable confirmation dialog gates the call; Enable is one-click from the hero.

## DTO shapes (canonical)

```ts
type DeckGoSkillStatus = "ready" | "needs-setup" | "disabled";

type DeckGoSkillInstallOption = {
  id: string;
  label: string;
  bins: string[];
};

type DeckGoSkillEntry = {
  key: string;
  name: string;
  status: DeckGoSkillStatus;
  source: "bundled" | "managed" | "plugin";
  enabled: boolean;
  missingRequirements?: string[];
  config?: Record<string, unknown>;
  description?: string;
  emoji?: string;
  homepage?: string;
  installOptions?: DeckGoSkillInstallOption[];
  primaryEnv?: string;
};

type DeckGoSkillsResponse = {
  skills?: Record<string, unknown>[];
};

type DeckGoSkillUpdateResponse = {
  ok?: boolean;
  config?: Record<string, unknown>;
};

type DeckGoSkillHubSearchResult = {
  score?: number;
  slug: string;
  displayName: string;
  summary?: string;
  version?: string;
  updatedAt?: number;
};

type DeckGoSkillHubSearchResponse = { results?: DeckGoSkillHubSearchResult[] };

type DeckGoSkillHubDetailResponse = {
  skill: {
    slug: string;
    displayName: string;
    summary?: string;
    tags?: Record<string, string>;
    createdAt?: number;
    updatedAt?: number;
  } | null;
  latestVersion?: { version: string; createdAt?: number; changelog?: string } | null;
  metadata?: { os?: string[] | null; systems?: string[] | null } | null;
  owner?: { handle?: string; displayName?: string } | null;
};

type DeckGoSkillHubBinsResponse = { bins?: string[] };

type DeckGoSkillHubMutationResponse = Record<string, unknown> & {
  ok?: boolean;
  message?: string;
  error?: string;
};
```

## BFF projections (not part of the contract)

Two BFF-side projections power the prototype's richer surfaces:

### `triggers: string[]`

Extracted from each skill's SKILL.md frontmatter `description` field, parsed by the BFF. Used
by the **Triggers** tab. Falls back to empty array if SKILL.md is unavailable.

### `files: SkillFile[]`

```ts
interface SkillFile {
  path: string;
  bytes: number;
}
```

BFF projection over the skill's manifest directory listing (SKILL.md + references/). Used by
the **Files** tab and the SkillReadmeDialog. Falls back to empty array if the projection isn't
implemented for this skill.

### `audit: SkillAuditEvent[]`

```ts
interface SkillAuditEvent {
  ts: number;
  actor: "system" | string;
  action: "installed" | "updated" | "disabled" | "needs-setup" | string;
  note?: string;
}
```

BFF projection over the BFF mutation log + status transitions. Used by the **Audit** tab.

## Endpoint summary

| Endpoint                                | Method | When                              | DTO                              |
| --------------------------------------- | ------ | --------------------------------- | -------------------------------- |
| `/api/deck/skills`                      | GET    | List view (installed mode)        | `DeckGoSkillsResponse`           |
| `/api/deck/skills/<key>`                | PATCH  | Configure dialog Save             | `DeckGoSkillUpdateResponse`      |
| `/api/deck/skills/<key>/enable`         | POST   | Hero Enable                       | `DeckGoSkillHubMutationResponse` |
| `/api/deck/skills/<key>/disable`        | POST   | DisableConfirmDialog confirm      | `DeckGoSkillHubMutationResponse` |
| `/api/deck/skills/hub/search?q=…`       | GET    | List view (hub mode)              | `DeckGoSkillHubSearchResponse`   |
| `/api/deck/skills/hub/<slug>`           | GET    | Install wizard / Preview          | `DeckGoSkillHubDetailResponse`   |
| `/api/deck/skills/hub/<slug>/bins`      | GET    | Install wizard bins preview       | `DeckGoSkillHubBinsResponse`     |
| `/api/deck/skills/hub/<slug>/install`   | POST   | Install wizard Install button     | `DeckGoSkillHubMutationResponse` |
| `/api/deck/skills/<key>/triggers` (BFF) | GET    | Detail tab `triggers`             | `string[]`                       |
| `/api/deck/skills/<key>/files` (BFF)    | GET    | Detail tab `files` + ReadmeDialog | `SkillFile[]`                    |
| `/api/deck/skills/<key>/audit` (BFF)    | GET    | Detail tab `audit`                | `SkillAuditEvent[]`              |

(The last three are BFF projections, not part of the Gateway skill contract.)

## Backend chain

```
SkillsPanel / skill helper components
  → frontend-new/src/api/skills.ts
  → deck-go Go BFF routes
    ├── Gateway RPC skills.list / skills.update / skills.enable / skills.disable
    ├── Hub proxy (hub.openclaw.io)
    └── BFF projections (triggers / files / audit)
  → Gateway (only via the BFF / runtime boundary)
```

## Mock requirements

- 12+ installed skills covering all 3 sources × all 3 statuses.
- 8+ hub results with realistic score distribution.
- Hub detail for at least 3 skills with full latestVersion / metadata / owner.
- Hub bins projection for every hub result the prototype surfaces.
- Trigger projection for at least 8 of 12 installed skills.
- File projection for at least 4 installed skills.
- Audit projection for at least 3 installed skills covering all event types.

## Open contract assumptions

- **`status` enumeration.** Closed set `ready | needs-setup | disabled` per
  `DeckGoSkillStatus`. Anything new should be co-grouped under `disabled` until contract
  expands.
- **`source` enumeration.** Closed set `bundled | managed | plugin`. Implicit (i.e., a skill
  that came from a plugin manifest but isn't enable-toggled in skills config) is treated as
  `plugin` source.
- **Disable behavior on managed skills.** Prototype copy assumes hub-managed bins are removed
  from PATH on next session start. Confirm with backend.
- **Hub install asynchrony.** Prototype's wizard runs synchronously to a final phase. Production
  may need a polling step if installs are queued — the wizard should accept a polling token
  parameter in that case.
- **`config` schema.** Free-form `Record<string, unknown>`. Some hub skills may carry a JSON
  schema that the Configure dialog should switch to schema-driven form rendering for.
- **Trigger source authority.** Prototype renders BFF-extracted trigger keywords. If the
  contract prefers SKILL.md as the source of truth, the chip render becomes a "View SKILL.md"
  affordance instead.
