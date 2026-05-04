# API usage

DTO authority: `deck-go/contracts/source/deck-api.contract.ts:1623-1705`. The frontend speaks only to the Go BFF — never directly to LanceDB or the memory filesystem.

## DTOs

```ts
type DeckGoMemoryFileNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
};

type DeckGoMemoryHealthEntry = {
  agentId: string;
  provider: string;
  embeddingStatus: "ok" | "error" | "unknown";
  error?: string;
};

type DeckGoMemoryBrowseResponse = {
  files?: DeckGoMemoryFileNode[];
  content?: string;
  path?: string;
};

type DeckGoMemoryHealthResponse = {
  entries?: DeckGoMemoryHealthEntry[];
  lanceDbEnabled?: boolean;
  agentId?: string;
  provider?: string;
  embedding?: { ok?: boolean; error?: string };
  error?: string;
};

type DeckGoMemorySearchScope = "all" | "global" | "agent";

type DeckGoMemorySearchResult = {
  path: string;
  content: string;
  relevance: number;
  tier?: "core" | "working" | "peripheral";
  scope?: string;
  decayScore?: number;
};

type DeckGoMemorySearchResponse = {
  results?: DeckGoMemorySearchResult[];
  unavailableReason?: string | null;
  lanceDbEnabled?: boolean;
};

type DeckGoMemoryDreamAction =
  | "read"
  | "backfill"
  | "reset"
  | "resetShortTerm"
  | "repair"
  | "dedupe";

type DeckGoMemoryDreamDiaryResult = {
  agentId: string;
  found: boolean;
  path: string;
  content?: string;
  updatedAtMs?: number;
};

type DeckGoMemoryDreamActionResult = {
  agentId: string;
  action: string;
  path?: string;
  found?: boolean;
  scannedFiles?: number;
  written?: number;
  replaced?: number;
  removedEntries?: number;
  removedShortTermEntries?: number;
  changed?: boolean;
  archiveDir?: string;
  archivedDreamsDiary?: boolean;
  archivedSessionCorpus?: boolean;
  archivedSessionIngestion?: boolean;
  warnings?: string[];
  dedupedEntries?: number;
  keptEntries?: number;
};

type DeckGoMemoryDreamsResult = DeckGoMemoryDreamDiaryResult | DeckGoMemoryDreamActionResult;
```

The frontend MUST consume these via `import type { ... } from "@/types/deck-api"` — do not redeclare.

## Endpoints

### Browse

```
GET /api/memory/browse?path={path}
→ 200 DeckGoMemoryBrowseResponse
→ 404 if path doesn't exist
→ 401 if scope insufficient
```

`path` is one of:

- A directory path → response has `files[]`, no `content`
- A file path → response has `content`, no `files`
- (omitted, or `/`) → response has root-level `files[]`

The prototype's `BROWSE_TREE` map (in data.js) is the in-memory equivalent of this endpoint, keyed by directory path. Production fetches lazily on directory expand to keep payloads small.

```ts
const dir = await browseMemory("/agents/main");
const file = await browseMemory("/agents/main/core.md");
```

### Search

```
POST /api/memory/search
Content-Type: application/json

{ "query": "<text>", "scope"?: "all" | "global" | "agent", "agentId"?: "<id>" }

→ 200 DeckGoMemorySearchResponse
→ 501 with unavailableReason if LanceDB not configured (response.lanceDbEnabled === false)
→ 401 if scope insufficient
```

`query` is required. `scope` defaults to `all` if omitted. `agentId` is required only when `scope === "agent"`.

Response semantics:

- `results: []` + `lanceDbEnabled: true` → empty results (legitimate "no match")
- `results: []` + `lanceDbEnabled: false` + `unavailableReason: "<reason>"` → fallback active; results may still be there if BFF runs keyword fallback, or the array may be empty
- `results: [...]` → real results, ranked by relevance descending

```ts
const r = await searchMemory({ query: "runtime mode", scope: "all" });
if (!r.lanceDbEnabled) showWarn(r.unavailableReason);
const hits = r.results ?? [];
```

The UI MUST render the warning when `lanceDbEnabled === false` regardless of whether results are empty.

### Health

```
GET /api/memory/health
→ 200 DeckGoMemoryHealthResponse
→ 401 if scope insufficient
```

The contract's response is intentionally flexible:

- `entries[]` — preferred shape (multi-agent)
- Top-level `agentId`, `provider`, `embedding{ok, error}` — single-agent fallback for backward compat

The UI normalizes both into a list of `DeckGoMemoryHealthEntry`. Production polls every 30s.

```ts
const h = await fetchMemoryHealth();
const entries =
  h.entries ??
  (h.agentId
    ? [
        {
          agentId: h.agentId,
          provider: h.provider!,
          embeddingStatus: h.embedding?.ok ? "ok" : "error",
          error: h.embedding?.error,
        },
      ]
    : []);
```

### Dreams (read + maintenance actions)

```
POST /api/memory/dreams
Content-Type: application/json

{ "agentId": "<id>", "action": DeckGoMemoryDreamAction }

→ 200 DeckGoMemoryDreamsResult (discriminated union)
→ 400 if agentId missing or action invalid
→ 401 if scope insufficient
```

Discriminator:

- `action === "read"` → response is `DeckGoMemoryDreamDiaryResult` (has `found`, `path`, optional `content` + `updatedAtMs`)
- everything else → response is `DeckGoMemoryDreamActionResult` (has `action` + various counters)

```ts
const diary = await runMemoryDreams({ agentId: "main", action: "read" });
const result = await runMemoryDreams({ agentId: "main", action: "dedupe" });
```

Use the `action` field to disambiguate at runtime. Producing the `DreamsResult` as a single union is intentional — the BFF sometimes returns either shape from the same endpoint depending on the requested action.

## Caching strategy (production)

| Resource                | Cache                                            | Invalidation                                                                       |
| ----------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `browse` (directory)    | Per-path in a Map; keep for panel lifetime       | On a successful action that mutates the directory (e.g., `reset` archives entries) |
| `browse` (file content) | Per-path with stale-while-revalidate; 1-hour TTL | Manual reload only (memory files rarely change)                                    |
| `search`                | Not cached (each query is unique)                | —                                                                                  |
| `health`                | 30s TTL; refetch on tab focus                    | On manual Refresh button                                                           |
| `dreams` (read)         | Per-agent; refresh after a successful action     | On `backfill`/`dedupe`/`repair`/`reset`/`resetShortTerm`                           |

## Drift gate

Run `cd deck-go && make contract-gate` after any DTO source edit. CI blocks merges that desync `deckapi.generated.go` and `deck-api.generated.ts` from `deck-api.contract.ts`.

## BFF projection

The BFF translates between the contract DTOs and the underlying Gateway RPC + LanceDB calls:

- `GET /api/memory/browse` → `agents.files.list` (workspace resolution) + filesystem read
- `POST /api/memory/search` → LanceDB query (when enabled) or keyword fallback
- `GET /api/memory/health` → `doctor.memory.status`
- `POST /api/memory/dreams` → `doctor.memory.dreamDiary` / `doctor.memory.backfillDreamDiary` / `doctor.memory.dedupeDreamDiary` / `doctor.memory.repairDreamingArtifacts` / `doctor.memory.resetDreamDiary` / `doctor.memory.resetGroundedShortTerm`

The wire DTO must stay byte-stable across BFF refactors. The frontend MUST NOT depend on Gateway internal shapes.

## Error & drift rules

- Empty `entries` (`undefined` or `[]`) renders empty health table; KPIs all show 0.
- Empty `files` (in browse response) renders an empty directory.
- Missing `content` on a file fetch is a hard error (not graceful degrade) — show the viewer error block.
- Search 501 / `unavailableReason` is a warning, not an error — render as a yellow pill in the results-head.
- Dreams action 4xx → toast with the action name; revert UI to idle.
- Dreams action 5xx → toast with retry; preserve any `actionResult` from a prior successful run.

## Scope & audit

| Action                                                        | Required scope   | Audit row                               |
| ------------------------------------------------------------- | ---------------- | --------------------------------------- |
| `GET /api/memory/browse`                                      | `operator.read`  | none                                    |
| `POST /api/memory/search`                                     | `operator.read`  | none                                    |
| `GET /api/memory/health`                                      | `operator.read`  | none                                    |
| `POST /api/memory/dreams` action=`read`                       | `operator.read`  | none                                    |
| `POST /api/memory/dreams` action=`backfill`/`dedupe`/`repair` | `operator.write` | yes (agentId + action + counters)       |
| `POST /api/memory/dreams` action=`resetShortTerm`             | `operator.admin` | yes (agentId + counters + archive path) |
| `POST /api/memory/dreams` action=`reset`                      | `operator.admin` | yes (agentId + counters + archive path) |

The deck-go session token must carry the right scope. Below `operator.write`: hide the dangerous action buttons (not just disable). Below `operator.admin`: hide `Reset` and `Reset short-term`.
