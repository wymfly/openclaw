## ADDED Requirements

### Requirement: Memory File Tree Browsing

The memory browser SHALL display a file tree of agent memory directories. The Deck Server SHALL first check whether the `memory-lancedb` extension is enabled (via plugin config); if enabled, it SHALL dynamically resolve the LanceDB data path from the extension's configuration. If the extension is not enabled, the browser SHALL fall back to file-based browsing of the default memory-core file storage. No Gateway RPC is required for file browsing.

#### Scenario: Display memory file tree (LanceDB enabled)

- **WHEN** the user navigates to the Memory Browser panel and the `memory-lancedb` extension is detected as enabled
- **THEN** the panel SHALL display a hierarchical file tree rooted at the LanceDB data path resolved from plugin config, with expandable folders and file names

#### Scenario: Display memory file tree (file-based fallback)

- **WHEN** the user navigates to the Memory Browser panel and the `memory-lancedb` extension is not enabled
- **THEN** the panel SHALL display a hierarchical file tree of the default memory-core file storage with expandable folders and file names

#### Scenario: View memory file content

- **WHEN** the user clicks on a file in the memory tree
- **THEN** the panel SHALL read the file content via server-side File I/O and display it in a read-only viewer

### Requirement: Vector Search

The memory browser SHALL provide a vector search interface that queries the LanceDB vector database embedded in the Deck Server (via `@lancedb/lancedb` SDK). No Gateway RPC is used for search.

#### Scenario: Execute vector search

- **WHEN** the user enters a search query and submits
- **THEN** the panel SHALL perform a vector similarity search against the LanceDB database and display ranked results with relevance scores and content previews

### Requirement: Knowledge Graph Visualization

The memory browser SHALL render a knowledge graph showing relationships between memory entries (links, references, tags).

#### Scenario: Display knowledge graph

- **WHEN** the user activates the graph view
- **THEN** the panel SHALL render an interactive node-link diagram where nodes represent memory documents and edges represent references or shared tags

### Requirement: Memory Health Diagnostics

The memory browser SHALL display health diagnostics for the memory subsystem via the `doctor.memory.status` Gateway RPC. The returned fields are: `agentId`, `provider` (memory provider name), `embedding.ok` (boolean), and `embedding.error` (optional error string). Gateway does not provide orphan/broken-link counts.

#### Scenario: Display health diagnostics

- **WHEN** the user views the health diagnostics section
- **THEN** the panel SHALL call `doctor.memory.status` and display for each agent: agent ID, memory provider name, embedding health status (ok/error), and error details if present
