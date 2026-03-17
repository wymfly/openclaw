## ADDED Requirements

### Requirement: Multi-Key Embedder with Rotation

The memory enhancement module SHALL replace the existing embedder in `extensions/memory-lancedb/` with an upgraded embedder supporting multi-key rotation across embedding API keys and an LRU cache for recently computed embeddings.

#### Scenario: Key rotation on rate limit

- **WHEN** an embedding API call returns a rate limit error (429)
- **THEN** the embedder SHALL automatically rotate to the next configured API key and retry the request without exposing the error to the caller

#### Scenario: LRU cache hit

- **WHEN** an embedding is requested for content that was recently embedded
- **THEN** the embedder SHALL return the cached embedding vector without making an API call

### Requirement: Auto-Chunking

The embedder SHALL automatically chunk documents that exceed the embedding model's token limit before computing embeddings.

#### Scenario: Large document chunking

- **WHEN** a document exceeds the embedding model's maximum token limit
- **THEN** the embedder SHALL split the document into overlapping chunks (configurable overlap), embed each chunk independently, and store chunk-to-document mappings

### Requirement: Hybrid Retriever (Vector + BM25 + Rerank)

The memory enhancement module SHALL replace the existing retriever with a hybrid retriever that combines vector similarity search, BM25 keyword search, and a reranking stage.

#### Scenario: Hybrid search execution

- **WHEN** a retrieval query is submitted
- **THEN** the retriever SHALL execute both vector similarity search and BM25 keyword search in parallel, merge the result sets, apply reranking, and return the top-K results ordered by rerank score

#### Scenario: BM25 fallback for exact matches

- **WHEN** a query contains exact technical terms or identifiers not well-captured by vector similarity
- **THEN** the BM25 component SHALL surface documents containing the exact terms, which the reranker SHALL boost if contextually relevant

### Requirement: Adaptive Retrieval

The retriever SHALL support adaptive retrieval that adjusts the search strategy (number of candidates, rerank depth) based on query characteristics.

#### Scenario: Short query adaptation

- **WHEN** a retrieval query is fewer than 5 tokens
- **THEN** the adaptive retriever SHALL increase the initial candidate pool size to compensate for the sparse query vector

### Requirement: Noise Filter

The memory enhancement module SHALL include a noise filter that identifies and deprioritizes low-quality or repetitive memory entries during retrieval.

#### Scenario: Filter repetitive content

- **WHEN** retrieval results contain near-duplicate entries (cosine similarity > 0.95 between results)
- **THEN** the noise filter SHALL retain only the highest-scoring entry from each duplicate cluster and deprioritize the rest

#### Scenario: Filter low-quality entries

- **WHEN** a memory entry has very low information density (e.g., fewer than 10 meaningful tokens)
- **THEN** the noise filter SHALL assign a penalty score that reduces the entry's ranking in retrieval results
