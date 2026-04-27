## ADDED Requirements

### Requirement: Chat layout matches old Deck desktop

The Vite Chat panel SHALL match old Deck desktop layout, including session sidebar, central transcript, right panel modes, agent/session controls, context/status bars, and input composer hierarchy.

#### Scenario: Chat opens on desktop

- **WHEN** the Chat panel opens on desktop
- **THEN** the visible layout SHALL match old Deck perceptual structure for sidebar, transcript, right panel, and composer.

### Requirement: Chat renderer stack is complete

The Vite Chat panel SHALL restore old Deck renderer components for message blocks, markdown, table/json/code views, bash output, file diffs, highlighted file content, raw toggles, virtual long output, canvas embeds, unknown blocks, and nested tool results.

#### Scenario: Tool result contains bash output

- **WHEN** a Chat transcript contains a bash tool result
- **THEN** Vite Chat SHALL render the old Deck-equivalent bash result view rather than a plain generic card.

### Requirement: Chat interaction affordances match old Deck

The Vite Chat panel SHALL preserve old Deck interaction affordances for session selection, agent tabs, message actions, input history, slash commands, mentions, approvals, steering, search, filters, A2UI/canvas, subagents, and streaming status.

#### Scenario: User opens Chat action menus

- **WHEN** a user interacts with old Deck-equivalent Chat action icons or menus
- **THEN** Vite Chat SHALL expose the same workflow action or a documented Go-backed equivalent.

### Requirement: Chat copy is fully localized

All visible Chat-local copy SHALL switch between English and Chinese.

#### Scenario: Locale switches while Chat is active

- **WHEN** the user switches locale while Chat is active
- **THEN** Chat controls, empty states, dialogs, placeholders, filters, action menus, and status text SHALL switch language except for proper nouns, code, IDs, and user data.

### Requirement: Chat theme parity is preserved

Chat-local surfaces SHALL preserve old Deck-equivalent light and dark visual hierarchy while reusing the completed shell theme baseline.

#### Scenario: Theme switches while Chat is active

- **WHEN** the user switches between light and dark theme while Chat is active
- **THEN** Chat transcript, renderer cards, composer, dialogs, menus, status bars, right panel, and subagent surfaces SHALL remain old Deck-equivalent without reopening global shell theme work.

### Requirement: Chat backend parity gaps are fixed or classified

The Vite Chat migration SHALL fix Go backend/API/projection gaps required by old Deck Chat workflows when the Gateway source of truth supports the capability.

#### Scenario: Old Chat renderer needs missing stream metadata

- **WHEN** an old Chat renderer, action, right-panel mode, approval flow, subagent lineage view, or transcript recovery workflow needs session, event, or payload data missing from the Go backend
- **THEN** the implementation SHALL update the Go backend/API adapter or document a Gateway-unsupported exception before marking the Chat surface migrated.

### Requirement: Chat adapter seams are explicit

Every adapted old Chat component SHALL preserve current Vite runtime/store authority through an explicit adapter seam.

#### Scenario: Old component is adapt-ported

- **WHEN** an old Deck Chat component cannot be direct-ported into Vite
- **THEN** the implementation SHALL record the old assumptions, Vite inputs/hooks/stores, accepted transformation, and proof that Vite stores were not reshaped to mimic old Next.js internals.

### Requirement: Interaction exceptions are explicit

Intentional differences from old Deck Chat interactions SHALL be recorded per surface and linked to runtime capability evidence.

#### Scenario: Interaction differs from old Deck

- **WHEN** a Chat interaction differs from old Deck because of Go-backed or Gateway-backed behavior
- **THEN** the implementation SHALL record a per-surface exception linked to the backend gap ledger and classify it as `runtime-supported` or `Gateway-unsupported` before accepting the difference as migrated.

### Requirement: Chat validation uses the established Playwright MCP stack

Chat browser validation SHALL use the foreground Go backend, Go-managed local Gateway, Vite preview, and Codex Playwright MCP path established by the completed shell baseline.

#### Scenario: Browser validation runs for Chat parity

- **WHEN** Chat visual or interaction parity is validated in a browser
- **THEN** validation SHALL run through the Codex Playwright MCP against the Go backend plus managed Gateway stack, not through deprecated CLI smoke, shell-launched browser smoke, or CDP fallback.

#### Scenario: Live model credentials are unavailable

- **WHEN** local model credentials or runtime configuration are unavailable for a live Chat send
- **THEN** deterministic renderer, transcript, interaction, and screenshot validation SHALL remain blocking, while the live-send gap SHALL be recorded separately as a runtime credential/configuration limitation.
