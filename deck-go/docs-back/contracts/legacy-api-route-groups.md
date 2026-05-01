# Legacy API Route Groups

This document captures the first-pass route topology of legacy Deck under
`dashboard/src/app/api/`.

## High-level counts

Observed route-file counts by top-level group:

| Group        | Route files |
| ------------ | ----------: |
| `chat`       |          15 |
| `deck`       |           9 |
| `models`     |           8 |
| `usage`      |           8 |
| `devices`    |           7 |
| `channels`   |           6 |
| `agents`     |           5 |
| `config`     |           5 |
| `cron`       |           5 |
| `skills`     |           5 |
| `approvals`  |           4 |
| `memory`     |           4 |
| `webhooks`   |           4 |
| `docs`       |           3 |
| `gateway`    |           3 |
| `monitor`    |           3 |
| `onboarding` |           3 |
| others       |   remaining |

Total observed route files: `170`

## Immediate migration implication

The route layer is already acting as a backend façade, not merely a page-framework convenience layer.

Priority groups for migration planning:

1. `stream`
2. `chat`
3. `config`
4. `channels`
5. `deck`
6. `models`
7. `logs`
8. `sessions`

## Notes

- Dense route groups do not automatically mean “migrate first.”
- Migration priority is determined by cutover-critical workflow dependency, not raw route count.
