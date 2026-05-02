# agents — implementation notes

## Design-system adaptation map

The production implementation uses `frontend-new` canonical design-system
truth. Handoff names that do not exist in the atom barrel are adapted as follows:

| Handoff concept       | Production mapping                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `Switch`              | Canonical `Toggle` atom                                                                        |
| `Avatar`              | Module-private molecule in `components/panels/agents/`                                         |
| `EmptyState`          | Module-private molecule unless promoted by a later shared-pattern change                       |
| `KeyHint`             | Module-private text/chip treatment                                                             |
| `AgentRowCard`        | Module-private composite                                                                       |
| `ConfigSectionHeader` | Module-private composite                                                                       |
| `Status dot`          | CSS-only module element                                                                        |
| `--ds-space-*`        | Existing `--ds-sp-*` scale                                                                     |
| `--ds-danger*`        | Existing `--ds-error` / `--ds-error-bg`; no new token unless later cross-module need is proven |

## Implementation constraints

- The external prototype is visual guidance, not code truth.
- Production components call `frontend-new/src/api.ts` wrappers; panel code does
  not assemble raw endpoint/action strings.
- Create flow submits only current backend-supported fields initially:
  `name`, `workspace`, `emoji`, `avatar`.
- Server-side search/sort/filter/pagination is not assumed by the first
  implementation.
- Realtime state follows declared stream events (`activity.event` and
  `agent.status.changed`) and ignores unknown payloads.
