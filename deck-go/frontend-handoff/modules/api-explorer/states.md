# API Explorer States

## Describe State

| State                 | Trigger                              | UI                                                          |
| --------------------- | ------------------------------------ | ----------------------------------------------------------- |
| Loading               | `fetchGatewayDescribe()` pending     | describe status badge shows loading; layout remains stable  |
| Ready with methods    | `methods` has entries                | method catalog, selected method, schema sections            |
| Ready with no methods | `methods` missing or empty           | empty catalog note, events/untyped still visible if present |
| Not configured        | BFF returns `gateway_not_configured` | shared Gateway not-configured empty state                   |
| Error                 | other describe failure               | inline error note and refresh action                        |

## Method State

- Default selection is the first method sorted by name.
- Existing selection remains when refresh still contains that method.
- If selected method is no longer present, fallback to the first sorted method.
- Search filters by method name or scope.
- Empty search result renders a no-match note.

## Event State

- Events tab renders all described events sorted by name.
- Missing event payload renders no-schema state.
- Event tab does not mutate selected method.

## Schema State

- Missing `params`, `result`, or `payload` renders `No schema described`.
- Properties render sorted by property name.
- Required markers come from the parent schema `required` array.
- Enum values render as compact pills.
- Nested properties/items are expandable only when present and within max depth.

## Untyped State

- Empty or missing `untyped` hides the untyped section.
- Non-empty `untyped` renders visible governance evidence.
- Untyped methods are not treated as failed describe calls.
