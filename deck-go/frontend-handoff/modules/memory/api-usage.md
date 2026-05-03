# API Usage

## Frontend Wrappers

Use only the existing wrappers from `frontend-new/src/api.ts`:

| Wrapper                   | Endpoint                      | Gateway method / source                               |
| ------------------------- | ----------------------------- | ----------------------------------------------------- |
| `fetchAgentsList()`       | `GET /agents`                 | `agents.list`                                         |
| `browseMemory(agentId)`   | `GET /memory/browse?agentId=` | Deck BFF, workspace resolved from `agents.files.list` |
| `readMemoryFile(...)`     | `GET /memory/browse?read=1`   | Deck BFF filesystem read inside resolved workspace    |
| `searchMemory(params)`    | `GET /memory/search`          | Deck BFF; LanceDB-unavailable fallback is valid       |
| `fetchMemoryHealth()`     | `GET /memory/health`          | `doctor.memory.status`                                |
| `runMemoryDreams(action)` | `POST /memory/dreams`         | `doctor.memory.*` methods                             |

Browser code must not call Gateway RPC directly.

## DTOs

The production UI and mocks should remain shaped by:

- `DeckGoMemoryBrowseResponse`
- `DeckGoMemorySearchResponse`
- `DeckGoMemoryHealthResponse`
- `DeckGoMemoryDreamsResult`
- `AgentsFilesListResult`
- `DoctorMemoryStatusResult`
- `DoctorMemoryDreamDiaryResult`
- `DoctorMemory*DreamDiaryResult` action payloads

## Mock Fixture Requirements

The mock Gateway should include:

- `agents.files.list` with a real readable workspace path for `main`
- at least one file and one directory in that workspace
- `doctor.memory.status` returning an embedding status
- `doctor.memory.dreamDiary` returning a found diary with content
- maintenance action methods for backfill, dedupe, repair, reset, and
  reset-grounded-short-term

Search results do not need to be invented while the Deck BFF search endpoint
returns `501 Not implemented`. The UI should surface that unavailable state as
first-class visual evidence.

## Drift Handling

Fix deterministic mock/API drift when the contract shape is clear. Do not infer
real LanceDB ranking, dream repair side effects, or memory storage semantics from
mock data alone.
