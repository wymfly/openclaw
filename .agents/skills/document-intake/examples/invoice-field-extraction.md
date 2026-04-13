# Example — invoice field extraction

## User request

“帮我从这张发票扫描件里提取关键信息。”

## Input type

- scanned image or scanned PDF

## Recommended method

1. Treat this as OCR + layout-aware extraction, not pure visual description
2. Extract likely fields such as:
   - invoice number
   - seller/buyer
   - date
   - currency
   - subtotal / tax / total
3. Distinguish:
   - found
   - inferred
   - missing
   - unreadable

## Preferred output

- readable bullet list first
- compact key-value block if useful
- uncertainty note if scan quality is poor
