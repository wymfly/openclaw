# OCR Strategy

Use this guide when the input is a scan, photographed document, screenshot, or
image-heavy PDF.

The main mistake to avoid is collapsing all image tasks into "OCR".

There are three distinct jobs:

1. **visual description**
2. **text OCR**
3. **layout-aware extraction**

---

## 1. When visual description is enough

Prefer visual description when the user wants:

- "what's in this screenshot?"
- "what error is shown here?"
- "describe this interface"
- "what chart is this?"

In those cases, OCR may be optional or only used to support the description.

---

## 2. When OCR is necessary

Prefer OCR when the user wants:

- exact text
- exact labels
- codes, IDs, invoice numbers, totals
- searchable/reusable text from scans

Examples:

- scanned invoice
- photographed contract page
- screenshot with important text labels
- scanned table or form

---

## 3. When layout-aware extraction is necessary

OCR alone is not enough when:

- table structure matters
- fields are positional
- labels and values are separated visually
- multi-column layouts exist

Examples:

- invoices
- receipts
- forms
- tables embedded in scans
- screenshots of dashboards

In these cases, combine OCR with explicit layout reasoning.

---

## 4. Recommended decision order

1. Ask: is the user asking for **visual meaning** or **exact text**?
2. If exact text matters, use OCR-oriented reasoning
3. If structure matters, do OCR + layout-aware extraction
4. If the image is blurry or partial, say so explicitly

---

## 5. Quality caveats

Be cautious when:

- text is tiny
- the photo is angled
- the image is compressed
- there are shadows/glare
- tables are cut off
- handwriting is involved

Use uncertainty labels such as:

- "likely reads"
- "not clearly legible"
- "table boundaries are partially inferred"
- "some values may be missing from the visible crop"

---

## 6. OCR output style

Default to human-readable output first:

- what the image appears to contain
- the recognized text or fields
- any uncertainty notes

Add structured output only when the user asks or when it clearly helps.

---

## 7. OCR fallback principle

If the platform already provides an image understanding result:

- reuse it for high-level interpretation
- only reopen OCR-style processing when the user needs precision or text fidelity

Do not redo OCR just because the file is an image.
