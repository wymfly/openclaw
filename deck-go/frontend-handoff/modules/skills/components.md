# Skills Components

## Production target

`deck-go/frontend-new/src/components/panels/skills/`

## Component tree

```text
SkillsPanel
├─ SkillsOverviewHeader
│  ├─ SkillMetric[]
│  └─ action/status strip
├─ SkillInventoryRail
│  ├─ search input
│  ├─ status filter
│  └─ SkillInventoryRow[]
├─ SelectedSkillWorkbench
│  ├─ SelectedSkillHero
│  ├─ RequirementEvidence
│  ├─ SkillConfigEditor
│  ├─ InstallOptions
│  └─ raw selected skill JsonDetails
├─ ClawHubWorkbench
│  ├─ bin chips
│  ├─ search controls
│  ├─ ClawHubResultRow[]
│  └─ ClawHubDetail
├─ AgentSkillMatrix
│  ├─ agent headers
│  ├─ matrix cells
│  └─ last matrix action JsonDetails
└─ ActionEvidence
   ├─ last skill action JsonDetails
   └─ last hub action JsonDetails
```

## Data boundaries

- `SkillsPanel` owns async loading and mutation state.
- `SkillInventoryRail` receives normalized `DeckGoSkillEntry[]`, selected key, filters, counts, and callbacks.
- `SelectedSkillWorkbench` receives the selected normalized skill plus raw config drafts.
- `ClawHubWorkbench` receives bins, query, results, detail, action states, and callbacks.
- `AgentSkillMatrix` receives agents, `DeckGoAgentSkillsResponse` by agent id, normalized skills, action key, and callbacks.
- `JsonDetails` remains the raw evidence surface. Do not hide raw payloads behind custom parsing.

## Local molecules

These are module-local until a separate design-system proposal defines stable shared APIs:

- skill metric tile
- inventory row
- selected skill hero
- requirement evidence strip
- config editor surface
- install option row
- ClawHub catalog row
- agent matrix cell
- action evidence seam

## Accessibility and layout notes

- Inventory rows and matrix cells are buttons with clear focus states.
- Matrix toggles need descriptive labels: add/remove skill for agent.
- Long skill names, keys, env names, slugs, and config hashes must wrap or truncate inside constrained regions.
- The first viewport should show inventory, selected detail, ClawHub state, and matrix summary without nested decorative cards.
