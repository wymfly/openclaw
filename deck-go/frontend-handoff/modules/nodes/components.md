# Nodes Components

## Operations Shell

- Two-column workbench.
- Left column: node inventory, pending pairing queue, summary metrics, refresh.
- Right column: selected node lifecycle, identity evidence, guarded actions, dynamic envelopes, payload disclosures.

## Node Inventory Row

- Displays display name or node id, platform, connected state, paired state, and small capability/command hints.
- Selected row uses a left accent and stable background.
- Offline and unpaired rows remain selectable.

## Pending Pairing Row

- Displays request id, display name, node id, platform, repair state, and timestamp evidence.
- Listed pending requests select the matching node when present.
- Orphan pending requests open a pairing-only detail state.

## Lifecycle Strip

- Connected and paired: positive tone.
- Pending or repair request: warning tone.
- Paired but offline: warning tone.
- Unpaired: neutral tone with next-step guidance.

## Remote Action Forms

- Rename: simple text input and action result disclosure.
- Pairing: request, approve, reject, verify token.
- Invoke: command select, timeout input, JSON params textarea, confirmation gate.
- Pending work: type select, priority select, wake checkbox, confirmation gate.

## Evidence Surfaces

- Metric tiles for node count, pending count, selected command count, permission count.
- Capability/command/permission chip clusters.
- Raw `JsonDetails` for selected node, pairing request, and last action result.

## Local Molecules

These stay module-local until a separate design-system proposal:

- node inventory row
- pairing request row
- lifecycle strip
- guarded remote action form
- dynamic action envelope
- permission/capability chip cluster
