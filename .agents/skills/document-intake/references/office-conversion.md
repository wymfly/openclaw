# Office Conversion Strategy

This guide covers how to think about Office binary documents when the platform
does not already provide a high-quality textual representation.

Targets:

- DOCX
- XLSX
- PPTX

---

## 1. General rule

Do **not** treat Office binaries as opaque blobs.

Convert them into a **readable intermediate representation** before reasoning
deeply about them, unless the current context is already sufficient.

The goal of conversion is not archival fidelity. The goal is:

- preserve hierarchy
- preserve table semantics
- preserve sheet/slide boundaries
- preserve numbers, units, and labels

---

## 2. DOCX

### Primary goal

Recover:

- headings
- paragraphs
- lists
- embedded tables
- section hierarchy

### Preferred intermediate shape

- readable Markdown-like text
- sectioned plain text with headings
- table-preserving textual representation when possible

### Key review questions

- Are headings preserved?
- Are bullets still recognizable?
- Did inline tables collapse into unreadable text?
- Are repeated labels or form-like sections still aligned?

### Common failure modes

- hierarchy flattened
- tables reduced to illegible whitespace text
- numbered sections lost

When those happen, avoid overconfident extraction.

---

## 3. XLSX

### Primary goal

Recover:

- sheet names
- header rows
- row/column semantics
- units and currencies
- totals/subtotals
- obvious formulas when relevant

### Preferred intermediate shape

- per-sheet structured reading
- sample rows + header map
- readable table form

### Key review questions

- What is the true header row?
- Are there merged headers?
- Are there multiple logical tables per sheet?
- Do totals sit inside the data body or in a footer row?
- Are date columns actually dates or just strings?

### Common failure modes

- sheet name ignored
- first non-empty row assumed to be header when it is not
- totals treated as ordinary rows
- units lost

### Guidance

For spreadsheets, "convert to text" is often not enough. Preserve sheet-level
structure and header semantics explicitly.

---

## 4. CSV

CSV is simpler but still needs care.

### Focus on

- delimiter sanity
- quoted commas/newlines
- header detection
- typed columns
- empty vs missing values

### Common failure modes

- header row mistaken
- numbers, dates, IDs silently normalized incorrectly
- trailing totals treated as ordinary rows

---

## 5. PPTX

### Primary goal

Recover:

- slide titles
- bullet hierarchy
- section flow
- chart labels
- key callouts

### Preferred intermediate shape

- slide-by-slide readable outline
- title + bullets + key visual notes

### Key review questions

- What is each slide trying to say?
- Which bullets are subordinate?
- Are charts essential evidence or decorative?
- Are there images/screenshots that need separate interpretation?

### Common failure modes

- all bullets flattened into one paragraph
- slide order lost
- visuals ignored

---

## 6. Conversion fallback rules

If the first conversion result is poor:

1. reduce ambition
   - answer the user's question using only the reliable parts
2. say what was lost
   - headings, table structure, slide layout, etc.
3. reopen the original object if the user's requested outcome requires precision

Do not hide poor conversion quality behind overconfident prose.
