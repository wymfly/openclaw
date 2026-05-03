# Components

## Production Component Tree

```text
ThreadsPanel
  ThreadsHeader
  ThreadsFilterBar
  ThreadsMetricStrip
  ThreadInventory
    ThreadInventoryRow
  ThreadDetail
    ThreadHero
    ThreadRelationshipMap
      RelationshipNode(thread)
      RelationshipNode(session)
      RelationshipNode(agent)
    ThreadMetadataGrid
    ThreadHandoffActions
    ThreadPayloadDisclosure
```

The production code may keep small helper components in separate files if that
keeps `ThreadsPanel.tsx` reviewable. Component boundaries are implementation
choices; the visual contract is the inventory/detail workspace.

## Props

### ThreadInventory

```ts
type ThreadInventoryProps = {
  threads: DeckGoThreadEntry[];
  selectedThreadId: string;
  onSelectThread: (threadId: string) => void;
};
```

### ThreadDetail

```ts
type ThreadDetailProps = {
  thread: DeckGoThreadEntry | null;
  handoffMessage: string;
  onCopySessionKey: () => void;
  onOpenAgent: () => void;
  onOpenSession: () => void;
};
```

## Visual Rules

- Inventory rows prioritize label/thread id, channel, agent, target kind, and
  relative last activity.
- Detail view always keeps `threadId`, `targetSessionKey`, and `agentId`
  visible.
- Relationship map uses three stable nodes: platform thread, OpenClaw session,
  target agent.
- Long identifiers wrap or truncate inside constrained regions; they must not
  resize the workspace.
- Raw payload detail is secondary and collapsible.

## Local Molecules

Keep these local for this change:

- `threads-metric`
- `threads-thread-row`
- `threads-relation-node`
- `threads-handoff-strip`
- `threads-payload`

Promotion to shared design-system patterns requires a later proposal.
