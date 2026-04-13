---
name: document-intake
description: This skill should be used when the user uploads or references PDFs, DOCX files, XLSX spreadsheets, PPTX presentations, CSV files, screenshots, scans, or other document-like images and asks to summarize them, answer questions about them, perform OCR, extract fields, extract tables, or organize their contents into a clearer structure.
metadata: { "openclaw": { "emoji": "📎" } }
---

# Document Intake

Use this skill to process **documents and document-like images** as inputs.

This is a **methodology skill**, not a workflow skill. Do not assume the user
wants a specific business action. Use this skill to help decide **how to read,
interpret, and reshape the input**, while letting the user's request decide
**what result to produce**.

## What this skill is for

Use this skill when the input is primarily one or more of:

- PDF files
- DOCX files
- XLSX spreadsheets
- PPTX presentations
- CSV files
- screenshots
- scanned pages
- photographed documents
- charts/tables embedded in images

Typical user goals include:

- summarize the document
- answer questions about it
- OCR text from it
- extract key fields
- extract tables
- reorganize the content into a cleaner, human-readable structure

## What this skill is **not** for

Do **not** turn this into:

- an approval workflow
- a meeting workflow
- a task-management workflow
- a WeCom-specific writeback workflow
- a rigid command system with hardcoded modes

Do **not** decide the business action for the user. If the user says
"summarize this PDF", summarize it. If the user says "extract the invoice
fields", extract fields. If the user says "compare these two spreadsheets",
compare them. The skill provides method guidance, not business intent.

## Core operating model

Follow this mental model:

1. **Identify the real input type**
   - PDF vs Office binary doc vs plain-text table vs screenshot vs scan
2. **Check what the platform already made available**
   - existing body text
   - file context blocks
   - image descriptions
   - OCR/transcription outputs
   - attachment paths or staged file paths
3. **Reuse existing preprocessing first**
   - avoid redoing work when the current context is already sufficient
4. **Re-open the original object only when needed**
   - when the current context is incomplete, lossy, or clearly not good enough
5. **Shape the answer around the user's requested outcome**
   - human-readable first
   - structured output only when it materially helps

## Preferred output style

Default to **human-readable results first**:

- concise summary
- clear findings
- readable bullet lists
- short explanatory prose

When the user explicitly asks for structure—or structure clearly improves the
result—append a compact structured form such as:

- key-value field list
- Markdown table
- small JSON block

Do not lead with raw JSON unless the user clearly wants machine-readable output.

## Input-type guidance

### PDF

Assume PDFs may already have partial platform preprocessing.

Prefer this order:

1. reuse existing extracted text/context if it is already good enough
2. inspect page layout when the user asks for table extraction or field accuracy
3. fall back to OCR-style reasoning only when the PDF is image-based or the text
   is obviously incomplete

Pay special attention to:

- headers and section boundaries
- repeated templates/forms
- multi-column layouts
- tables split across pages
- units, currencies, totals, and footnotes

### DOCX

Treat DOCX as a rich text document, not just a blob to summarize blindly.

Look for:

- headings and hierarchy
- lists, checklist items, and numbered sections
- tables inside the document
- tracked or repeated sections if visible after conversion

When the platform has not already expanded the content into usable text, prefer
converting the document into a readable intermediate representation before
analyzing it.

### XLSX / CSV

Treat spreadsheets as **tabular data with semantics**, not plain text.

Always pay attention to:

- sheet names
- header rows
- merged or blank header cells
- units and currencies in headers
- date columns vs text columns
- totals, subtotals, and formulas
- whether the user wants row-level extraction vs summary-level analysis

For extraction tasks:

- preserve column meaning
- do not silently rename ambiguous headers without noting it
- distinguish between missing values and empty-string values when relevant

### PPTX

Treat presentations as structured slides, not long-form prose.

Focus on:

- slide titles
- section flow
- bullets and nested bullets
- charts, diagrams, and callout text
- speaker-note-like context if available

When the user asks for summary, preserve the presentation's narrative shape:

- what is being proposed
- what evidence is shown
- what decisions or actions are implied

### Images, screenshots, and scans

Separate three possible jobs:

1. **visual description**
2. **text OCR**
3. **layout-aware extraction**

Do not collapse them automatically.

Examples:

- screenshot bug report → visual description + local text recognition if needed
- scanned invoice → OCR + field extraction
- photographed whiteboard → OCR + structural cleanup + uncertainty notes

If text legibility is poor, say so explicitly rather than inventing certainty.

## Task-shaping guidance

### Summary requests

For summaries:

- identify the document type first
- summarize the purpose before the details
- keep key numbers, dates, owners, and decisions
- include caveats when extraction quality is uncertain

### Question-answering requests

For Q&A:

- answer only from the available document evidence
- quote or cite the relevant section/field when feasible
- call out uncertainty if the source is ambiguous or incomplete

### Field extraction requests

For field extraction:

- name the fields clearly
- keep original source wording where useful
- distinguish:
  - found
  - inferred
  - missing
  - unreadable

Do not merge inferred values into confirmed values without labeling them.

### Table extraction requests

For table extraction:

- preserve header structure
- preserve row ordering
- note merged cells or ambiguous header inheritance
- keep units with the relevant column when possible
- do not silently flatten complex tables without stating what changed

### Structured cleanup requests

For "organize this" or "clean this up" tasks:

- preserve the document's meaning
- reduce repetition
- normalize labels
- group related content
- keep important identifiers and numbers verbatim

Do not over-normalize if that would destroy auditability.

## Multi-file handling

Do not treat "single file" and "multiple files" as different capability modes.

Use the same method in both cases:

1. inspect each object on its own terms
2. extract per-file findings
3. only synthesize across files if the user asked for comparison, consolidation,
   deduplication, or cross-document reasoning

If multiple files are present but the user did not specify whether to merge or
compare them, ask a short clarification instead of guessing.

## Reuse vs reprocessing

Prefer **reuse** when:

- the platform already supplied good extracted text
- image/file context is already sufficient
- the user only needs a straightforward summary or answer

Prefer **reprocessing** when:

- Office binary documents are still opaque
- the existing context is visibly lossy
- table structure matters
- OCR quality matters
- the user requests precision extraction

## Uncertainty policy

Be explicit about uncertainty. Use phrases like:

- "not clearly readable"
- "likely"
- "appears to be"
- "field not visible in the provided pages"
- "table structure is partially inferred"

Never invent fields, rows, totals, or textual content just to complete a schema.

## Good activation examples

This skill is a good fit for requests like:

- "summarize this PDF"
- "extract the invoice fields from this scan"
- "what does this spreadsheet say?"
- "pull the table out of this document"
- "OCR this screenshot and organize the result"
- "compare these two files and tell me the differences"
- "turn this messy document into a clean structured outline"

## Final principle

Treat the uploaded document or image as the **source of truth**, the existing
platform preprocessing as a **helpful first pass**, and the user's explicit
request as the **determinant of the final output style**.

## Additional resources

Use these files when the task needs more specificity than the main skill body:

### Reference files

- `references/tool-selection.md`
  - Input type × task type × preferred processing path
- `references/office-conversion.md`
  - How to think about DOCX/XLSX/PPTX conversion into readable intermediate forms
- `references/ocr-strategy.md`
  - When to prefer visual description, OCR, or layout-aware extraction
- `references/table-extraction.md`
  - Table-specific extraction rules across PDF, spreadsheet, and image inputs

### Example files

- `examples/pdf-summary.md`
- `examples/invoice-field-extraction.md`
- `examples/spreadsheet-question-answering.md`
- `examples/image-ocr-cleanup.md`
