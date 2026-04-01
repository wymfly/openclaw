---
name: office-docs
description: |
  Read, extract, and generate office documents (PDF, DOCX, XLSX, PPTX, CSV).
  Use this skill whenever the user wants to: extract data from PDFs or scanned documents,
  fill data into Excel spreadsheets, generate Word reports, convert between document formats,
  process inspection/test reports, batch-process a folder of documents, create invoices or
  formatted tables from raw data, or do OCR on images/scans. Also trigger when user mentions
  specific file extensions like .pdf, .docx, .xlsx, .pptx, .csv, or talks about
  "extracting tables", "filling spreadsheets", "generating reports", or "document conversion".
---

# Office Document Processing

You are an expert at reading, extracting, and generating office documents. Your approach:
extract data from source documents using built-in tools, then write Python scripts to
generate well-formatted output files.

## Core Principle

**Read with built-in tools, write with Python libraries.** The model can natively read
PDFs and images. For generating documents, write and execute Python scripts using the
libraries listed below. Always install dependencies before use.

## Reading Documents

### PDF (built-in)

Use the `Read` tool directly — it handles PDF natively, including tables and forms.
For multi-page PDFs, specify page ranges: `pages: "1-5"`.

When the PDF contains tables, carefully parse the visual layout. Pay attention to:

- Column headers and their alignment
- Multi-row cells and merged cells
- Units in headers (e.g., "%" or "mm")
- Comparison rows (e.g., "standard requirement" vs "measured value")

### Images / Scanned Documents

Use the `Read` tool — it handles images (PNG, JPG) as a multimodal model.
For Chinese text in scans where built-in reading is insufficient:

```bash
# Install PaddleOCR (best for Chinese)
pip install paddlepaddle paddleocr

# Or Tesseract (better for English)
brew install tesseract
```

### DOCX / PPTX / Other Formats

Convert to readable format first:

```bash
# Install markitdown (Microsoft's universal converter)
pip install markitdown

# Convert any document to Markdown
markitdown input.docx > output.md
markitdown input.pptx > output.md
markitdown input.xlsx > output.md
```

## Extracting Structured Data

After reading a document, extract data into a clean Python dict/list structure
before writing to any output format. This intermediate step ensures accuracy.

### Example: Inspection Report Extraction

For test/inspection reports (chemical analysis, mechanical testing, etc.):

```python
# Step 1: Define the data structure
report = {
    "metadata": {
        "report_number": "2022SHR15358",
        "customer": "...",
        "sample_date": "2022.11.07",
        "test_date": "2022.11.07~2022.11.08",
        "lab_number": "22SS041721",
        "sample_name": "GH4169",
        "sample_material": "GH4169",
        "batch_number": "221030-3DFS119",
    },
    "test_results": {
        "method": "ASTM E3047-16",
        "equipment": "SPECTRO MAXx",
        "elements": [
            {"element": "C",  "value1": 0.0377, "value2": 0.0362, "avg": 0.037,  "spec": "<=0.08"},
            {"element": "Si", "value1": 0.0401, "value2": 0.0388, "avg": 0.039,  "spec": "<=0.35"},
            # ... more elements
        ],
        "conclusion": "pass"  # or "fail"
    }
}
```

### Batch Processing Pattern

When processing multiple files of the same type:

```python
import glob, json

pdf_files = glob.glob("/path/to/reports/*.pdf")
all_reports = []

for pdf_path in pdf_files:
    # Read each PDF (you do this via the Read tool, not in the script)
    # Extract data into the standard structure
    # Append to all_reports
    pass

# Then generate one consolidated Excel from all_reports
```

For batch processing, read each PDF with the `Read` tool one by one, extract the
structured data, collect it all, then generate the output in a single script run.

## Generating Excel (XLSX)

Use `openpyxl` for full-featured Excel generation.

```bash
pip install openpyxl
```

### Key Patterns

```python
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter

wb = Workbook()
ws = wb.active
ws.title = "Sheet Name"

# --- Headers with styling ---
headers = ["Element", "Value 1", "Value 2", "Average", "Spec", "Result"]
header_font = Font(bold=True, size=11)
header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
header_font_white = Font(bold=True, size=11, color="FFFFFF")

for col, header in enumerate(headers, 1):
    cell = ws.cell(row=1, column=col, value=header)
    cell.font = header_font_white
    cell.fill = header_fill
    cell.alignment = Alignment(horizontal="center")

# --- Data rows ---
for row_idx, element in enumerate(data, 2):
    ws.cell(row=row_idx, column=1, value=element["name"])
    ws.cell(row=row_idx, column=2, value=element["value1"])
    # ... more columns

# --- Auto-fit column widths ---
for col in range(1, len(headers) + 1):
    max_len = max(
        len(str(ws.cell(row=r, column=col).value or ""))
        for r in range(1, ws.max_row + 1)
    )
    ws.column_dimensions[get_column_letter(col)].width = max(max_len + 2, 10)

# --- Borders ---
thin_border = Border(
    left=Side(style="thin"),
    right=Side(style="thin"),
    top=Side(style="thin"),
    bottom=Side(style="thin"),
)
for row in ws.iter_rows(min_row=1, max_row=ws.max_row, max_col=len(headers)):
    for cell in row:
        cell.border = thin_border

wb.save("output.xlsx")
```

### Tips

- Use `number_format` for decimals: `cell.number_format = '0.0000'`
- For merged cells: `ws.merge_cells('A1:C1')`
- For multiple sheets: `wb.create_sheet("Sheet2")`
- For formulas: `cell.value = '=AVERAGE(B2:B10)'`
- Always set column widths — auto-fit makes output professional

## Generating Word (DOCX)

Use `python-docx`.

```bash
pip install python-docx
```

```python
from docx import Document
from docx.shared import Inches, Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = Document()

# Title
doc.add_heading("Report Title", level=0)

# Paragraph with formatting
p = doc.add_paragraph()
run = p.add_run("Bold text")
run.bold = True

# Table
table = doc.add_table(rows=1, cols=3, style="Table Grid")
header_cells = table.rows[0].cells
header_cells[0].text = "Column A"

# Add data rows
for item in data:
    row = table.add_row().cells
    row[0].text = str(item["field"])

doc.save("output.docx")
```

## Generating Presentations (PPTX)

For simple slides, use Marp (Markdown to slides):

```bash
npm install -g @marp-team/marp-cli
marp input.md --pdf  # or --pptx
```

For programmatic control, use `python-pptx`:

```bash
pip install python-pptx
```

## Format Conversion

### Any format to PDF

```bash
# Install LibreOffice (universal converter)
brew install --cask libreoffice

# Convert
libreoffice --headless --convert-to pdf input.docx
libreoffice --headless --convert-to pdf input.xlsx
```

### Any format to Markdown

```bash
markitdown input.pdf > output.md
```

### Markdown to DOCX/PDF

```bash
brew install pandoc
pandoc input.md -o output.docx
pandoc input.md -o output.pdf
```

## Dependency Installation

Before first use, install the core libraries:

```bash
pip install openpyxl python-docx markitdown
```

Optional (install when needed):

```bash
pip install python-pptx        # PPTX generation
pip install paddlepaddle paddleocr  # Chinese OCR
brew install --cask libreoffice    # Format conversion
brew install pandoc                # Markdown conversion
```

## Workflow Summary

| Task                    | Approach                                            |
| ----------------------- | --------------------------------------------------- |
| Read PDF                | `Read` tool (built-in)                              |
| Read DOCX/PPTX/XLSX     | `markitdown` CLI → Markdown                         |
| Read scanned/image docs | `Read` tool (multimodal), or PaddleOCR for Chinese  |
| Extract structured data | Model parses content → Python dict                  |
| Write XLSX              | `openpyxl` script                                   |
| Write DOCX              | `python-docx` script                                |
| Write PPTX              | `python-pptx` or Marp                               |
| Convert to PDF          | `libreoffice --headless`                            |
| Batch process           | Loop read → extract → collect → single write script |
