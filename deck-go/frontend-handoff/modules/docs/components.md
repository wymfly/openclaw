# Docs Components

## Component Tree

```txt
DocsPanel
  DocsInventoryColumn
    DocsHeader
    DocsStatusStrip
    DocsMetricGrid
    DocsCategoryFilter
    DocsSearchAndActions
    DocsList
      DocsRow
  DocsDetailColumn
    DocsDetailHeader
    DocsHero
    DocsSourceGrid
    DocsKeywordStrip
    DocsMarkdownReader
    DocsPayloadDisclosure
    DocsActionDisclosure
```

## Props / Data Contracts

### DocsPanel

- Owns async load state, selected document ID, cached details, filters, delete confirmation, action state, action result, and error copy.
- Reads active chat session key from the existing chat store hook.
- Calls the existing API wrappers only.

### DocsInventoryColumn

- Inputs:
  - `docs: DeckGoDoc[]`
  - `visibleDocs: DeckGoDoc[]`
  - `selectedDocId: string`
  - `category: DeckGoDocCategory | "all"`
  - `query: string`
  - `loadState: "idle" | "loading" | "ready"`
  - `activeSessionKey?: string`
- Outputs:
  - select document
  - set category
  - set query
  - refresh
  - extract active session
  - delete selected / cancel confirmation

### DocsRow

- Renders category, title, preview, keywords, language, source session, and updated/extracted timestamp.
- Uses row selected state only; no row-level mutation.
- Long text wraps or clamps in a stable row height.

### DocsDetailColumn

- Inputs:
  - `selectedDoc: DeckGoDoc | null`
  - `actionResult: unknown`
- Outputs:
  - navigate to source session
  - navigate to source agent
- Renders Markdown via the production `MarkdownText` renderer and raw payload via `JsonDetails`.

## Local Molecules

- Document metric tile
- Category filter chip
- Document inventory row
- Selected document hero
- Source evidence tile
- Markdown reader surface
- Last-action raw evidence seam

These stay local for this change. Any promotion to canonical design-system atoms requires a separate design-system proposal.
