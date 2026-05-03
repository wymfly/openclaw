## ADDED Requirements

### Requirement: Prototype files SHALL contain only hardcoded strings

Every file under `deck-go/frontend-handoff/modules/<x>/` (the prototype workspace) SHALL contain only literal display strings for human-readable text. Prototype files SHALL NOT call any of the following:

- `t(...)` from any i18n library
- `useTranslations(...)` from `next-intl`, `react-i18next`, or any wrap thereof
- `import` statements from `next-intl`, `next-intl/*`, the Vite shim at `@/compat/next-intl`, or any other i18n module
- Mock i18n factories that simulate `t()` calls (e.g., `const t = (k) => k;`)

The string SHALL appear in its display form in the source file (e.g., `<h1>Agents</h1>`, NOT `<h1>{t("agents.title")}</h1>` or `<h1>agents.title</h1>`).

#### Scenario: Prototype author writes a heading

- **WHEN** the agents prototype file `agents/list-view.jsx` defines a heading
- **THEN** the source SHALL contain `<h1>Agents</h1>` literally
- **AND** the source SHALL NOT contain `useTranslations` or any i18n call
- **AND** the source SHALL NOT contain dotted i18n keys masquerading as text

#### Scenario: Prototype author tries to mock an i18n catalog

- **WHEN** a designer writes `const t = (k) => ({ "title": "Agents" }[k]);` in a prototype file
- **THEN** code review SHALL reject the change with the rule citation
- **AND** the prototype SHALL be updated to use literal strings directly

### Requirement: Engineering implementation extracts strings to i18n at translation time

When Claude Code translates a `frontend-handoff/modules/<x>/` prototype into `frontend-new/src/components/panels/<x>/`, the implementer SHALL:

- Extract every literal display string from the prototype into `frontend-new/src/i18n/<x>.json` (or merged into existing `en.json` / `zh.json` per project convention)
- Rewrite component code to call the project's i18n hook (currently `useTranslations` via the next-intl-via-compat-shim, until i18n stack-decisions is re-locked)
- Preserve string content and meaning byte-for-byte; the act of extraction SHALL NOT change wording, punctuation, or capitalization without explicit reviewer approval

The i18n extraction SHALL happen in a single pass at engineering implementation time, NOT incrementally during prototype iteration.

#### Scenario: Engineering implementer extracts agents prototype strings

- **WHEN** Claude Code begins implementing `frontend-new/src/components/panels/agents/` from `frontend-handoff/modules/agents/`
- **THEN** every literal string in `agents/list-view.jsx` SHALL be added as an i18n entry
- **AND** the equivalent `frontend-new/src/components/panels/agents/AgentsListView.tsx` SHALL call `useTranslations("agentsPanel")` and reference the new keys
- **AND** the resulting visual output SHALL match the prototype text exactly

#### Scenario: A late prototype-iteration string change

- **WHEN** the designer updates a prototype label after engineering implementation has begun
- **THEN** the designer SHALL update the prototype source file
- **AND** the engineering implementer SHALL re-sync the i18n entry in the next reverse-sign-off cycle
- **AND** the divergence SHALL appear in the module's `implementation-notes.md` if material

### Requirement: Prototype string rule is documented in handoff protocol

`frontend-handoff/CLAUDE.md` SHALL include a dedicated "Prototype string rule" subsection inside its Translation rules section. The subsection SHALL state the rules in this spec verbatim or by reference, with a one-line summary at the top: "Prototype hardcodes display strings; engineering implementation extracts to i18n in one pass."

The same rule SHALL be cross-referenced from `docs/project/stack-decisions.md` so that any agent reading either document discovers it.

#### Scenario: Designer reads handoff protocol before authoring a new prototype

- **WHEN** a designer opens `frontend-handoff/CLAUDE.md` to start a new module prototype
- **THEN** the Translation rules section SHALL contain the prototype string rule with explicit examples of what to do and what not to do

#### Scenario: Engineering implementer reads stack-decisions

- **WHEN** Claude Code reads `docs/project/stack-decisions.md` to confirm the i18n stack
- **THEN** the i18n entry SHALL note the prototype string rule with a link back to the handoff protocol section
