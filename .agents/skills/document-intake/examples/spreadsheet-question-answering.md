# Example — spreadsheet Q&A

## User request

“看看这个 Excel，告诉我哪个部门的预算最高，以及有没有异常值。”

## Input type

- XLSX spreadsheet

## Recommended method

1. Identify the relevant sheet(s)
2. Identify the real header row
3. Preserve units/currency semantics
4. Separate data rows from totals/subtotals
5. Answer the question directly from the spreadsheet evidence

## Preferred output

- direct answer in prose
- brief supporting bullets with the relevant rows/columns
- mention ambiguity if headers or sheet semantics are unclear
