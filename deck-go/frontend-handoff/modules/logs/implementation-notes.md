# logs - implementation notes

## Production divergence

- The production panel uses canonical `Badge`, `Button`, `Card`, `Code`,
  `Input`, `Select`, `Spinner`, and `Toggle` atoms instead of the prototype's
  inline controls.
- Native checkboxes were retained for level filters to preserve accessibility
  and existing unit-test semantics.
- `JsonDetails` and `EventFeedCard` remain shared legacy helpers inside the new
  local visual shell because they already own raw payload/event rendering.
- No backend forwarding change was needed; `/logs` already forwards `cursor`,
  `limit`, and `maxBytes`.

## Design-system feedback

- Reused tokens and atoms were sufficient; no canonical atom or token changed.
- `MetricTile`, compact workbench headers, and section headings now repeat
  across agents, routing, subagents, and logs. These should be promoted only in
  a dedicated design-system proposal.
- `LogLineRow`, `LiveTapeRow`, and `PayloadSeam` are observability-specific and
  remain local until another module confirms the same API shape.

## Verification intent

- Unit coverage protects tail load, stream connect, local filters, export
  preview, stream batch, cursor persistence, and reset handling.
- Mock visual E2E uses contract-shaped `logs.tail` fixture data and should be
  treated as visual coverage only, not as real Gateway/LLM streaming proof.
