# OpenClaw Memory System Blueprint

> Date: 2026-04-13
> Scope: Enhanced fork memory system analysis + enablement roadmap
> Baseline: OpenClaw v2026.4.12, `dorian-modem` branch

---

## 1. Architecture Overview

```
+------------------------------------------------------------------+
|                    Plugin Slot: memory                             |
|            plugins.slots.memory = "memory-core"                   |
+---+------------+------------+-------------+-----------+-----------+
    |            |            |             |           |
+---v----+ +----v-----+ +----v------+ +----v----+ +----v-------+
|memory  | |memory    | |memory    | |active   | |  Honcho    |
|-core   | |-lancedb  | |-wiki     | |-memory  | | (external) |
|file+   | |vector DB | |knowledge | |session  | | cross-     |
|dreaming| |auto-     | |vault +   | |level    | | session    |
|        | |capture   | |Obsidian  | |recall   | | user model |
+---+----+ +----+-----+ +----+-----+ +----+----+ +----+-------+
    |            |            |             |           |
+---v------------v------------v-------------v-----------v----------+
|                   Memory Host SDK                                 |
|   MemorySearchManager | Embedding Engine | Storage Engine         |
+---+--------------+--------------+--------------------------------+
    |              |              |
+---v------+ +----v-----+ +-----v----+
| Builtin  | |   QMD    | |  Custom  |
| SQLite   | | sidecar  | | (future) |
| FTS5+vec | | reranking| | Pinecone |
+----------+ +----------+ | Qdrant   |
                           +----------+
```

### Four Memory Extensions

| Extension          | Role                          | Storage                                    | Key Capability                                                                               |
| ------------------ | ----------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| **memory-core**    | Core, file-driven             | `MEMORY.md` + `memory/*.md` + SQLite index | Dreaming engine, short-term to long-term promotion, `memory_search` tool                     |
| **memory-lancedb** | Enhanced, vector-driven       | LanceDB vector table                       | Auto-capture/recall, 6-category taxonomy, noise prototype filtering, cross-encoder reranking |
| **memory-wiki**    | Supplementary, knowledge base | Obsidian-style vault                       | Claim/evidence structure, backlinks, wiki compilation                                        |
| **active-memory**  | Session-level                 | In-memory + JSONL                          | Pre-reply memory injection, message/recent/full context modes                                |

### Three Storage Backends

| Backend               | Type                     | Dependencies                        | Best For                                     |
| --------------------- | ------------------------ | ----------------------------------- | -------------------------------------------- |
| **Builtin** (default) | SQLite FTS5 + sqlite-vec | Zero                                | Single user, <100K entries                   |
| **QMD**               | Local sidecar binary     | `npm install -g @tobilu/qmd`        | Reranking, query expansion, session indexing |
| **Honcho**            | External service         | `@honcho-ai/openclaw-honcho` plugin | Cross-session user modeling, multi-agent     |

---

## 2. Default Support Status

### Enabled Out of the Box

| Capability                           | Default | Condition                              |
| ------------------------------------ | ------- | -------------------------------------- |
| BM25 keyword search                  | **ON**  | No configuration needed                |
| `memory_search` tool                 | **ON**  | memory-core plugin auto-registers      |
| `memory_get` tool                    | **ON**  | Same as above                          |
| `MEMORY.md` long-term memory         | **ON**  | Loaded at every DM session start       |
| Daily notes (`memory/YYYY-MM-DD.md`) | **ON**  | Auto-written                           |
| Pre-compaction memory flush          | **ON**  | Triggers when context approaches limit |

### Requires Configuration

| Capability               | Default            | Enable Condition                                                     |
| ------------------------ | ------------------ | -------------------------------------------------------------------- |
| Vector search (semantic) | OFF -> **auto-on** | Any embedding API key present (OpenAI/Gemini/Voyage/Mistral/Bedrock) |
| Hybrid search            | **auto-on**        | When vector search enabled; default vector:0.7 + lexical:0.3         |
| Dreaming (consolidation) | **OFF**            | `memory-core.config.dreaming.enabled = true`                         |
| MMR diversity reranking  | OFF                | `query.hybrid.mmr.enabled = true`                                    |
| Temporal decay           | OFF                | `query.hybrid.temporalDecay.enabled = true`                          |
| Session memory indexing  | OFF                | `experimental.sessionMemory = true`                                  |
| Multimodal memory        | OFF                | Requires `gemini-embedding-2-preview`                                |

### Embedding Provider Auto-Detection Order

```
local (node-llama-cpp) > OpenAI > Gemini > Voyage > Mistral > Bedrock
```

No API key at all = BM25 keyword search only (functional but lower recall quality).

---

## 3. Dreaming Engine (Memory Consolidation)

Three-phase pipeline mimicking human sleep cycles:

```
Short-term memory (memory/*.md, session transcripts)
    |
    +-- Every memory_search call -> async record to short-term-recall.json
    |     (query hash, score, recall count, concept tags)
    |
    v  [LIGHT PHASE - every 6 hours]
    Sort and stage recent daily notes + session transcripts
    Score candidates at 0.58-0.62
    |
    v  [REM PHASE - weekly, Sunday 5am]
    Theme extraction + pattern recognition
    High-signal entries boosted up to 0.09
    |
    v  [DEEP PHASE - daily, 3am]
    Weighted scoring:
      frequency  0.24  (log1p(signals) / log1p(10))
      relevance  0.30  (avgScore from embedding)
      diversity  0.15  (unique queries or recall days / 5)
      recency    0.15  (14-day half-life exponential decay)
      consolidation 0.10  (multi-day spacing strength)
      conceptual 0.06  (concept tags richness)
      phaseBoost up to 0.09  (from Light/REM signals)
    |
    +-- score >= 0.75 AND recallCount >= 3 AND uniqueQueries >= 2
    |     -> Append to MEMORY.md (durable)
    |     -> Generate Dream Diary narrative (DREAMS.md)
    |
    +-- Below threshold -> Remains in short-term, awaits more signals
```

### Dreaming File Layout

| Artifact                | Path                                           | Purpose                          |
| ----------------------- | ---------------------------------------------- | -------------------------------- |
| Short-term recall store | `memory/.dreams/short-term-recall.json`        | All tracked memory signals       |
| Phase signals           | `memory/.dreams/phase-signals.json`            | Light/REM boost history          |
| Promotion lock          | `memory/.dreams/short-term-promotion.lock`     | Concurrency control              |
| Session corpus          | `memory/.dreams/session-corpus/YYYY-MM-DD.txt` | Redacted session transcripts     |
| Dream diary             | `DREAMS.md`                                    | Human-readable dreaming output   |
| Durable memory          | `MEMORY.md`                                    | Primary long-term knowledge base |
| Daily memory            | `memory/YYYY-MM-DD.md`                         | Append-only daily captures       |

---

## 4. Data Flow (End-to-End)

```
User sends message
  |
  v
Agent processes (system prompt includes memory guidance)
  |
  v
Agent calls memory_search(query)
  +-- 1. Generate query embedding (if provider available)
  +-- 2. SQLite FTS5 keyword search
  +-- 3. SQLite-vec vector search (if available)
  +-- 4. Hybrid fusion (0.7 vector + 0.3 text)
  +-- 5. Temporal decay + MMR de-duplication
  +-- 6. Return top-k results (default 6)
  |
  v
Async: recordShortTermRecalls() -> short-term-recall.json
  |
  v
Agent uses search results to generate reply
  |
  v
[When context approaches limit]
Memory Flush -> sub-agent extracts memories -> writes to memory/YYYY-MM-DD.md
  |
  v
[Dreaming cron trigger]
Light -> REM -> Deep -> Promote to MEMORY.md
```

---

## 5. Enablement Roadmap

### Phase 0: Immediate (Zero Code, Config Only)

| #   | Action                       | Command                                                                        | Effect                                      |
| --- | ---------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------- |
| 1   | Confirm memory enabled       | `openclaw config get agents.defaults.memorySearch.enabled`                     | Should be `true` (default)                  |
| 2   | Configure embedding provider | Ensure `OPENAI_API_KEY` or `GEMINI_API_KEY` env var exists                     | Upgrades from BM25 to hybrid search         |
| 3   | Enable Dreaming              | `openclaw config set plugins.entries.memory-core.config.dreaming.enabled true` | Activates 3-phase memory consolidation      |
| 4   | View Dream Diary             | Deck -> MemoryPanel -> Dreams tab                                              | Observe dreaming output quality             |
| 5   | Run memory diagnostics       | `openclaw memory status --deep`                                                | Verify index health, embedding availability |

**Outcome**: Full hybrid search + autonomous memory consolidation active.

### Phase 1: Low Cost (Plugin Install / Tuning, No Development)

| #   | Action                    | Method                                                           | Effect                                                                                             |
| --- | ------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 6   | Install memory-lancedb    | `openclaw plugins install memory-lancedb`                        | Vector storage + auto-capture (up to 3/conversation) + 6-category classification + noise filtering |
| 7   | Enable reranking          | memory-lancedb config `reranker: "cross-encoder"`                | Jina v3 cross-encoder, hard cutoff below 0.35                                                      |
| 8   | Tune hybrid weights       | `agents.defaults.memorySearch.query.hybrid.vectorWeight: 0.7`    | Adjust vector vs lexical ratio per use case                                                        |
| 9   | Enable temporal decay     | `query.hybrid.temporalDecay.enabled: true, halfLifeDays: 30`     | Old memories naturally decay, new ones rank higher                                                 |
| 10  | Enable MMR de-duplication | `query.hybrid.mmr.enabled: true, lambda: 0.7`                    | Reduce duplicate/similar results, improve diversity                                                |
| 11  | Configure local embedding | Install `node-llama-cpp` + download GGUF model                   | Fully offline embedding, zero API cost                                                             |
| 12  | REM manual backfill       | `openclaw memory rem-backfill --path memory/ --stage-short-term` | Stage historical "lasting truths" as Dreaming candidates                                           |

**Outcome**: Higher precision (reranking + MMR), auto-capture reduces manual management, offline capability.

### Phase 2: Production Scale (Development / Operations Required)

| #   | Action                        | Effort                                                              | Effect                                                                        |
| --- | ----------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 13  | Deploy QMD sidecar            | `npm install -g @tobilu/qmd` + config `memory.backend: "qmd"`       | High-performance reranking + query expansion + session transcript indexing    |
| 14  | Integrate Honcho service      | `openclaw plugins install @honcho-ai/openclaw-honcho` + deploy/host | Cross-session user modeling, multi-agent memory sharing                       |
| 15  | Install memory-wiki           | Plugin install + vault initialization                               | Obsidian-style knowledge vault, claim/evidence provenance, structured reports |
| 16  | Deck Memory Status Panel      | New MemoryStatusPanel component                                     | Visualize index health, embedding hit rate, Dreaming cycles, entry statistics |
| 17  | Multimodal memory             | `multimodal.enabled: true` + Gemini embedding                       | Image/visual content also indexed in memory                                   |
| 18  | Session memory indexing       | `experimental.sessionMemory: true`                                  | Full-text index of session transcripts, cross-session history search          |
| 19  | Custom vector backend         | Implement `MemoryPluginRuntime` interface                           | Connect Pinecone/Qdrant/Milvus for >100K entry scenarios                      |
| 20  | Multi-tenant memory isolation | Custom memory plugin + tenant routing                               | SaaS scenario, per-user isolated memory spaces                                |

---

## 6. Assessment: Third-Party Memory System Integration

### Not Recommended for Current Scope

| System                     | Assessment                                                                       |
| -------------------------- | -------------------------------------------------------------------------------- |
| **Mem0**                   | OpenClaw Dreaming is more sophisticated (3-phase scoring vs simple extraction)   |
| **LangMem**                | No equivalent to autonomous consolidation; manual-only                           |
| **Pinecone/Qdrant/Milvus** | Only useful at >100K entries; SQLite + LanceDB sufficient for single-user        |
| **Chroma**                 | LanceDB already provides equivalent vector functionality with better integration |

### When to Reconsider

- **>100K memory entries**: SQLite-vec performance degrades; consider Qdrant via custom `MemoryPluginRuntime`
- **Multi-tenant SaaS**: Need per-user isolation + shared knowledge base; build custom plugin
- **Real-time cross-agent**: Multiple agents need shared live memory; Honcho or custom solution
- **Compliance/audit**: Need immutable memory log with provenance; memory-wiki + custom audit layer

---

## 7. Key Configuration Reference

```jsonc
{
  "agents": {
    "defaults": {
      "memorySearch": {
        "enabled": true, // master switch
        "provider": "openai", // or "gemini", "voyage", "local", etc.
        "sources": ["memory", "sessions"],
        "query": {
          "maxResults": 6,
          "minScore": 0.0,
          "hybrid": {
            "enabled": true,
            "vectorWeight": 0.7,
            "textWeight": 0.3,
            "mmr": { "enabled": false, "lambda": 0.7 },
            "temporalDecay": { "enabled": false, "halfLifeDays": 30 },
          },
        },
      },
    },
  },
  "plugins": {
    "slots": {
      "memory": "memory-core", // or "none" to disable
    },
    "entries": {
      "memory-core": {
        "config": {
          "dreaming": {
            "enabled": false, // <-- set to true to activate
            "frequency": "0 3 * * *", // cron expression (3 AM daily)
          },
        },
      },
    },
  },
}
```

---

## 8. Deck Dashboard Coverage

| Memory Feature                           | Deck Panel                                      | Status             |
| ---------------------------------------- | ----------------------------------------------- | ------------------ |
| Dream Diary view + 5 maintenance actions | DreamDiaryTab (MemoryPanel -> Dreams)           | P1-5 done          |
| Active Memory config                     | Config Editor (`plugins.slots.memory`)          | P1-7 verified      |
| Memory search config                     | Config Editor (agents.defaults.memorySearch.\*) | Schema-driven auto |
| Dreaming config                          | Config Editor (memory-core.config.dreaming.\*)  | Schema-driven auto |
| Memory status diagnostics                | Not yet built                                   | Phase 2 item #16   |
| LanceDB stats/management                 | Not yet built                                   | Future             |
