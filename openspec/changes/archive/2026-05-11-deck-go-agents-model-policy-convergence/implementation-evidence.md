# Implementation Evidence

## Truth Mapping Preflight

Fresh code truth checked before implementation:

- `src/config/zod-schema.agent-model.ts`: `AgentModelConfig` accepts a string or `{ primary?: string; fallbacks?: string[] }`.
- `src/config/types.agent-defaults.ts` and `src/config/zod-schema.agent-defaults.ts`: supported Agents-owned global role model policy fields are `agents.defaults.model`, `imageModel`, `imageGenerationModel`, `videoGenerationModel`, `musicGenerationModel`, `pdfModel`, `compaction.model`, `memorySearch.model`, and `subagents.model`.
- `src/config/types.agents.ts` and `src/config/zod-schema.agent-runtime.ts`: per-agent `agents.list[].model` and `agents.list[].subagents.model` use `AgentModelConfig`.
- `src/gateway/protocol/schema/agents-models-skills.ts`: upstream `agents.create` / `agents.update` only accept `model?: string`, so primary+fallback policy cannot rely on those CRUD methods.
- `src/gateway/server-methods/deck/agents-skills.ts` and `src/gateway/server-methods/deck/agents-subagents-config.ts`: existing Deck control-plane pattern is typed `deck.agents.*` methods with base-hash protected config writes.
- `deck-go/frontend-new/src/components/panels/models/parts/UsagePolicyOverview.tsx`: Models displays usage policy read-only after the Models product-contract completion.
- `openspec/follow-ups/2026-05-09-agents-model-policy-redesign-handoff.md`: identifies Agents as the next owner for policy editing.

## Editable Policy Targets

| Key               | Config path                            | Shape               | Owner  |
| ----------------- | -------------------------------------- | ------------------- | ------ |
| `text`            | `agents.defaults.model`                | `AgentModelConfig`  | Agents |
| `image`           | `agents.defaults.imageModel`           | `AgentModelConfig`  | Agents |
| `imageGeneration` | `agents.defaults.imageGenerationModel` | `AgentModelConfig`  | Agents |
| `videoGeneration` | `agents.defaults.videoGenerationModel` | `AgentModelConfig`  | Agents |
| `musicGeneration` | `agents.defaults.musicGenerationModel` | `AgentModelConfig`  | Agents |
| `pdf`             | `agents.defaults.pdfModel`             | `AgentModelConfig`  | Agents |
| `compaction`      | `agents.defaults.compaction.model`     | string primary only | Agents |
| `memorySearch`    | `agents.defaults.memorySearch.model`   | string primary only | Agents |
| `subagents`       | `agents.defaults.subagents.model`      | `AgentModelConfig`  | Agents |
| `agent`           | `agents.list[].model`                  | `AgentModelConfig`  | Agents |
| `agentSubagents`  | `agents.list[].subagents.model`        | `AgentModelConfig`  | Agents |

## Unsupported / Read-only Findings

- `agents.defaults.summaryModel` is not defined by current OpenClaw schema truth. If present in old config it is reported as unsupported metadata and is not editable.
- `agents.defaults.models.<provider/model>.params` remains out of scope; this change does not edit provider/model parameter maps.
- Provider/model asset fields remain Models-owned. Agents links to Models for asset repair instead of creating provider/model assets.

## Initial Implementation Evidence

- Added typed Gateway protocol schemas for `deck.agents.modelPolicy.get` and `deck.agents.modelPolicy.set`.
- Added Gateway handler `src/gateway/server-methods/deck/agents-model-policy.ts` with normalized string/object reads, inheritance, unavailable references, base-hash validation, bounded target writes, clear/inherit behavior, and unsupported target rejection.
- Added focused Gateway tests in `src/gateway/server-methods/deck/agents.test.ts`.
- Verified with `pnpm test src/gateway/server-methods/deck/agents.test.ts`: 28 tests passed.
- Regenerated deck-go Gateway protocol artifacts with `cd deck-go && make protocol-update`.
- Verified generated Gateway protocol artifacts with `cd deck-go && make protocol-check`.

## Contract, BFF, Frontend, And E2E Evidence

- Deck-facing contract source now exposes model-policy target, selection, entry, get response, and set response DTOs.
- `/deck/agents` endpoint and mutation metadata now include `modelPolicy.get` and `modelPolicy.set`.
- Go BFF forwards `modelPolicy.get` and `modelPolicy.set` through generated typed Gateway bindings.
- Agents Data Fabric exposes `agentModelPolicyQueryOptions` and `useSaveAgentModelPolicyMutation` with base-hash enforcement and model-policy cache invalidation.
- Agents Runtime UI now owns model usage policy editing, including inherit/override, primary/fallback chains, global role defaults, string-only targets, unavailable refs, and guarded save copy.
- Subagents allow-list editing no longer writes model policy; the subagents page points back to Runtime -> Model usage policy.
- Mock Gateway fixture now implements `deck.agents.modelPolicy.get` / `set` with configured choices, per-agent policies, global defaults, unavailable ref calculation, and stale-hash rejection.

Fresh verification:

- `cd deck-go && make contract-gate`: passed after regenerating `deck-api-dynamic-surfaces` and `route-governance`.
- `cd deck-go/backend && GOCACHE=/tmp/deck-go-buildcache GOSUMDB=off go test ./internal/runtime/openclaw ./internal/server`: passed.
- `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/agents/__tests__/AgentsPanel.test.tsx src/data/modules/agents/queries.test.tsx src/data/modules/agents/mutations.test.tsx src/data/modules/agents/keys.test.ts`: 23 tests passed.
- `cd deck-go && make frontend-build`: passed.
- `cd deck-go && make e2e-mock-module MODULE=agents`: 2 Playwright tests passed, including dark main state, light/Chinese variant, empty/error states, and Data Fabric cache-return behavior.
- `cd deck-go && DECK_GO_REAL_GATEWAY_COMMAND=pnpm DECK_GO_REAL_GATEWAY_ARGS="exec tsx src/entry.ts gateway run --bind loopback --port {gatewayPort} --allow-unconfigured" make e2e-real-module MODULE=agents`: 3 Playwright tests passed.

## Real Gateway Startup Notes

- The first plain `make e2e-real-module MODULE=agents` attempt failed before test body execution while waiting for bundled runtime readiness.
- The fixed-port real stack also initially failed because the direct-dist launcher saw missing prepared runtime artifacts (`dist/.buildstamp` and `dist/control-ui/index.html`) and triggered `pnpm build`, which entered long `runtime-postbuild` dependency staging.
- A source launcher env file under `deck-go/.local/deck-go-real-stack/source-launch.env` starts the same real Gateway through `pnpm exec tsx src/entry.ts gateway run ...`, avoiding the prepared-runtime preflight build.
- API-level real verification against the source-launch real stack used isolated state under `deck-go/.local/deck-go-real-stack/isolated/data`, read `test-agent` model policy, wrote `cpa/gpt-5.4`, verified the write by reading it back, verified stale base hash rejection with status 502, and restored the original selection.

## Final Implementation Report

Changed surfaces:

- Gateway protocol and methods: `src/gateway/protocol/schema/deck.ts`, `src/gateway/protocol/index-extensions.ts`, `src/gateway/protocol/schema/protocol-schemas-extensions.ts`, `src/gateway/server-methods/deck/agents-model-policy.ts`, deck agents method aggregation, generated method/module registries, and focused Gateway tests.
- Deck contract chain: `deck-go/contracts/source/deck-api.contract.ts`, endpoint/mutation metadata, generated TS/Go DTOs, generated Gateway bindings, and contract-governance docs.
- Go BFF: `/deck/agents` action forwarding, typed Gateway query wrappers, managed-runtime dispatch, legacy inventory passthrough, and backend tests.
- Frontend: Agents API facades, Data Fabric query/mutation hooks, Agents runtime model-policy UI, subagent model-policy relocation copy, i18n, styling, and focused tests.
- E2E fixtures: mock Gateway model-policy get/set support plus Agents mock and real E2E coverage.
- Follow-ups: `openspec/follow-ups/2026-05-09-agents-model-policy-redesign-handoff.md` was resolved, and real E2E startup diagnostics were updated with the direct-dist/source-launch facts.

Contract-chain decisions:

- Agents owns runtime model usage policy; Models remains the provider/model asset editor and shows policy usage read-only.
- `deck.agents.modelPolicy.get` / `deck.agents.modelPolicy.set` are typed product methods because upstream `agents.update` only accepts `model?: string` and cannot represent fallback chains or clear/inherit semantics.
- Writes use explicit `clear: true` for inheritance/clear operations because generated Go optional object params can encode absent selections as empty structs.
- `agents.defaults.summaryModel` remains unsupported/read-only because current OpenClaw schema truth does not define it.

Product-design decisions:

- Per-agent runtime policy supports inherited/default state, explicit primary, fallback ordering, unavailable references, guarded save, and clear override.
- Global role defaults are exposed in Agents with shape-aware controls: `AgentModelConfig` fields get primary plus fallback chains, and string-only compaction/memory-search fields get primary-only controls.
- Subagent allow-list editing no longer writes model policy; subagent model policy is surfaced through the runtime model-policy section.

Closure evidence:

- `openspec validate deck-go-agents-model-policy-convergence --type change --strict`: passed.
- `openspec validate deck-go-models-product-contract-completion --type spec --strict`: passed.
- `openspec validate --all --strict`: this change passed, the touched accepted spec passed, and 18 unrelated historical specs failed; those failures were not introduced by this change and are not used as this change's closure gate.
- Contract, protocol, backend, frontend, mock E2E, and real E2E commands are recorded above with passing results.

Deferred handoffs:

- Real E2E startup diagnostics remain a repo-level follow-up for launcher hardening and log capture. The module's real E2E behavior itself passed through the source-launch real Gateway path.
- No remaining Agents model-policy product handoff is open from this change. Broader Agents module productization can start from the new model-policy contract surface.
