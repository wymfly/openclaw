# Deck Full Visual Comparison Dry Run Evidence

Date: 2026-04-27

This evidence only proves that the full visual comparison workflow can run
through Codex Playwright MCP and produce paired old/current desktop screenshots.
It does not claim full visual parity is complete.

## Stack

- Old reference: Next Deck at `http://localhost:3099`
- Current target: Vite/Go Deck at `http://127.0.0.1:4174`
- Go backend: `http://127.0.0.1:19566`
- Source Gateway: Go-managed local runtime at `ws://127.0.0.1:18789`
- Runtime health at capture time: `running`, `healthy`

Operational note: the old Next Deck reference rendered blank through
`http://127.0.0.1:3099` in this environment, but rendered correctly through
`http://localhost:3099`. The full comparison run should keep the old reference
on `localhost` unless that dev-server behavior is fixed.

## Scaffold Check

`node scripts/deck-visual-comparison-scaffold.mjs --check`

Result:

```json
{
  "ok": true,
  "rows": 150,
  "panels": 27,
  "outDir": ".omx/artifacts/deck-full-visual-parity-comparison",
  "wrote": false
}
```

## Playwright MCP Dry Run

Captured paired screenshots for 7 representative rows:

| Row                                        | Old screenshot                                                                                                             | Current screenshot                                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| shell-expanded-nav-and-active-panel-header | `.omx/artifacts/deck-full-visual-parity-comparison/screenshots/shell-expanded-nav-and-active-panel-header-old-en-dark.png` | `.omx/artifacts/deck-full-visual-parity-comparison/screenshots/shell-expanded-nav-and-active-panel-header-current-en-dark.png` |
| chat-empty-chat                            | `.omx/artifacts/deck-full-visual-parity-comparison/screenshots/chat-empty-chat-old-en-dark.png`                            | `.omx/artifacts/deck-full-visual-parity-comparison/screenshots/chat-empty-chat-current-en-dark.png`                            |
| agents-list-detail-workspace               | `.omx/artifacts/deck-full-visual-parity-comparison/screenshots/agents-list-detail-workspace-old-en-dark.png`               | `.omx/artifacts/deck-full-visual-parity-comparison/screenshots/agents-list-detail-workspace-current-en-dark.png`               |
| sessions-list-detail                       | `.omx/artifacts/deck-full-visual-parity-comparison/screenshots/sessions-list-detail-old-en-dark.png`                       | `.omx/artifacts/deck-full-visual-parity-comparison/screenshots/sessions-list-detail-current-en-dark.png`                       |
| approvals-pending-approvals                | `.omx/artifacts/deck-full-visual-parity-comparison/screenshots/approvals-pending-approvals-old-en-dark.png`                | `.omx/artifacts/deck-full-visual-parity-comparison/screenshots/approvals-pending-approvals-current-en-dark.png`                |
| channels-list-detail                       | `.omx/artifacts/deck-full-visual-parity-comparison/screenshots/channels-list-detail-old-en-dark.png`                       | `.omx/artifacts/deck-full-visual-parity-comparison/screenshots/channels-list-detail-current-en-dark.png`                       |
| settings-about                             | `.omx/artifacts/deck-full-visual-parity-comparison/screenshots/settings-about-old-en-dark.png`                             | `.omx/artifacts/deck-full-visual-parity-comparison/screenshots/settings-about-current-en-dark.png`                             |

All 14 screenshots were written as `1440 x 960` PNG files.

Browser result summary:

- Old reference page errors: `0`
- Current target page errors: `0`
- Current target console errors: `0`
- Old reference console errors: `2`

Old reference console caveat: both errors came from the Next dev reference
environment, not from the current Vite/Go Deck. They should still be reviewed
and recorded during the final comparison pass so the old reference does not
mask current regressions.

Locale caveat: the first old-reference shell sample initially exposed Chinese
navigation copy while later old-reference panel samples exposed English copy.
The final run must explicitly validate EN/ZH switching per panel before any
row receives a `pass` verdict.

## Remaining Gate

The final gate still requires all 150 rows from
`.omx/artifacts/deck-full-visual-parity-comparison/screenshot-matrix.md` to
receive paired old/current screenshots, console/page-error review, i18n audit,
interaction audit, backend-gap disposition, and explicit visual verdict notes.
