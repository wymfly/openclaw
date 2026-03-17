## ADDED Requirements

### Requirement: Document Auto-Extraction

The doc hub SHALL automatically extract structured documents from agent conversation histories using pattern matching and keyword analysis (Chinese + English).

#### Scenario: Extract documents from conversations

- **WHEN** a conversation contains structured content matching document patterns (summaries, plans, specifications, manuals, drafts)
- **THEN** the doc hub SHALL extract the content, assign a document type, and store it in the document index

### Requirement: Smart Categorization

Extracted documents SHALL be automatically categorized into one of five types: summary, plan, spec, manual, or draft.

#### Scenario: Categorize extracted document

- **WHEN** a document is extracted from a conversation
- **THEN** the doc hub SHALL assign a category based on keyword matching (e.g., "specification", "design doc" -> spec; "summary", "recap" -> summary) and display the category badge

### Requirement: Document Search

The doc hub SHALL provide a search interface for finding documents by keyword across titles and content.

#### Scenario: Search documents

- **WHEN** the user enters a search query in the doc hub
- **THEN** the panel SHALL return matching documents ranked by relevance with highlighted keyword matches

### Requirement: Document Browsing

The doc hub SHALL provide a browsable list of all extracted documents with filtering by category and agent source.

#### Scenario: Browse by category

- **WHEN** the user selects the "plan" category filter
- **THEN** the panel SHALL display only documents categorized as plans, sorted by extraction date descending

#### Scenario: Browse by agent

- **WHEN** the user selects a specific agent from the source filter
- **THEN** the panel SHALL display only documents extracted from that agent's conversations
