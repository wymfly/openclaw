# agents - tokens proposal

Status: **none required for this pass**.

The revised agents prototype uses only existing canonical `frontend-new` design-system tokens:

- typography: `--ds-font-sans`, `--ds-font-mono`, `--ds-fs-body`, `--ds-fs-code`, `--ds-fs-meta`, `--ds-line`
- spacing: `--ds-sp-*`
- radius: `--ds-radius-*`
- surfaces: `--ds-bg-*`, `--ds-bg-elev`, `--ds-bg-hover`, `--ds-bg-active`
- borders: `--ds-border-subtle`, `--ds-border`, `--ds-border-strong`
- statuses: `--ds-success`, `--ds-warn`, `--ds-error`, `--ds-accent`
- shadows: `--ds-shadow-md`, `--ds-shadow-lg`

## Local treatments

The following remain module CSS, not canonical tokens:

- status dot size and pulse
- metric tile layout
- detail hero gradient
- local row rhythm for preview/file/permission rows

## Promotion watch list

Revisit after routing/subagents are redesigned:

- compact metric tile
- section header with helper/action
- provenance preview row
- status-dot vocabulary

No token drift check is required unless production implementation changes canonical token files.
