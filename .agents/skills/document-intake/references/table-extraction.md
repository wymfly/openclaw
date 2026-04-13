# Table Extraction Guide

Use this guide for PDF tables, spreadsheet tables, and table-like content inside
images or scans.

Table extraction is not just "copy rows and columns". The core job is to
preserve **meaning**.

---

## 1. Preserve these first

Always preserve:

- header meaning
- row ordering
- column ordering
- units
- totals/subtotals
- group boundaries

If any of those are inferred rather than explicit, say so.

---

## 2. PDF tables

PDF tables are the most fragile.

Watch for:

- tables split across pages
- repeated headers
- multi-row headers
- merged cells
- column alignment carrying meaning
- footnotes below the table

### Guidance

- reconstruct the header carefully before extracting rows
- do not flatten multi-row headers without noting the flattening rule
- if a table continues on the next page, preserve that continuity

---

## 3. XLSX / CSV tables

Spreadsheet tables are usually more reliable, but semantics still matter.

Watch for:

- multiple sheets
- multiple tables in one sheet
- top matter before the real table
- summary rows mixed with data rows
- formulas vs displayed values

### Guidance

- treat sheet names as part of the context
- identify the real header row before extracting
- separate data rows from totals or summary rows

---

## 4. Image/scanned tables

Scanned tables need both OCR and layout reasoning.

Watch for:

- cut-off columns
- skewed rows
- low contrast
- borderless tables
- labels that sit outside the main grid

### Guidance

- do not claim exact row/column fidelity unless the layout is clear
- prefer a readable summary when exact reconstruction is too uncertain

---

## 5. Output recommendations

### Use Markdown table when:

- the table is reasonably rectangular
- headers are clear
- flattening will not destroy meaning

### Use labeled bullet lists when:

- rows are sparse
- headers are ambiguous
- merged cells make a rectangular table misleading

### Use compact JSON only when:

- the user requests machine-readable output
- or a later agent step obviously benefits from structure

---

## 6. Field extraction vs table extraction

Do not confuse them.

### Field extraction

Best when:

- the document has a few named values
- invoice number, vendor, total, due date, etc.

### Table extraction

Best when:

- repeated rows matter
- row/column relationships matter
- the user wants the data body, not just top-level metadata

---

## 7. Minimum honesty rule

If you cannot preserve the original table faithfully, do not pretend you did.

Say what changed:

- header flattened
- merged cells expanded
- some rows inferred
- page boundary stitched manually
