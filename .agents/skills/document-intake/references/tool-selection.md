# Tool Selection Guide

Use this guide to decide **which processing path to prefer** for each input type
and user goal.

The main principle:

1. **Reuse platform preprocessing first**
2. **Only reopen the raw object when the current context is insufficient**
3. **Choose the lightest path that preserves fidelity**

---

## 1. Fast decision table

| Input                   | User goal        | Prefer first                                | Reprocess when                                                      | Notes                                             |
| ----------------------- | ---------------- | ------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------- |
| PDF                     | summary / QA     | existing extracted text + file context      | layout matters, text is incomplete, or PDF is scanned               | Preserve section structure and key numbers        |
| PDF                     | field extraction | existing text if reliable                   | fields are positional, OCR quality is weak, or values are ambiguous | Label inferred vs confirmed values                |
| PDF                     | table extraction | existing PDF text only if table is trivial  | almost always reopen layout-aware path                              | Multi-page tables need explicit continuity checks |
| DOCX                    | summary / QA     | readable intermediate text                  | headings/lists/tables are missing or flattened badly                | Preserve hierarchy                                |
| DOCX                    | field extraction | readable intermediate text                  | field placement matters and the first pass is lossy                 | Tables may carry key fields                       |
| XLSX / CSV              | summary / QA     | spreadsheet/text representation             | sheet layout or numeric semantics are unclear                       | Preserve headers, units, and totals               |
| XLSX / CSV              | field extraction | per-sheet, per-header reading               | merged headers, formulas, or hidden assumptions matter              | Keep row-level ambiguity explicit                 |
| XLSX / CSV              | table extraction | spreadsheet structure                       | if extraction collapsed types or lost header inheritance            | Treat sheet names as part of semantics            |
| PPTX                    | summary          | slide titles + bullets + notes if available | charts/visual evidence matter and first pass is too thin            | Preserve narrative order                          |
| Image / screenshot      | description      | existing image understanding                | OCR/layout extraction is required                                   | Distinguish visual description from text OCR      |
| Scan / photographed doc | OCR              | OCR path                                    | text is low quality or layout-sensitive                             | Preserve confidence caveats                       |

---

## 2. Reuse first

Prefer reusing the current context when it already contains:

- coherent extracted text
- file context blocks
- image descriptions
- OCR or transcription outputs
- sufficiently precise values for the user's task

Avoid reprocessing just because a raw file exists.

Reprocess only when one of these is true:

- the current context is obviously incomplete
- the user requests high-precision extraction
- layout matters
- table structure matters
- OCR quality matters
- the current text looks flattened or lossy

---

## 3. Output shaping by goal

### Summary

- Favor concise human-readable prose
- Preserve purpose, key facts, key numbers, decisions, and caveats

### QA

- Answer directly from document evidence
- Quote or cite the supporting section/field when helpful

### Field extraction

- Output readable bullet lists first
- Add compact key-value blocks when useful
- Distinguish found / inferred / missing / unreadable

### Table extraction

- Prefer Markdown tables when they remain readable
- Use key-value sectioning when the source table is too complex to flatten cleanly

### Structured cleanup

- Reorganize into headings, bullets, or labeled sections
- Preserve auditability for names, dates, IDs, totals, and units

---

## 4. Do not over-automate

Do not silently convert one task into another.

Examples:

- "summarize this invoice" is not the same as "extract invoice fields"
- "read this screenshot" is not the same as "perform OCR"
- "compare these spreadsheets" is not the same as "merge them"

Let the user's request determine the task.
