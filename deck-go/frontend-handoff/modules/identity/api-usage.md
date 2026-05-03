# Identity API Usage

## Read

```ts
const response = await fetchIdentityLinks();
```

Expected shape:

```ts
type DeckGoIdentityLinksResponse = {
  links: Array<{
    canonical: string;
    peers: Array<{
      channel: string;
      peerId: string;
    }>;
  }>;
  configHash?: string;
};
```

## Link

```ts
await linkIdentityPeer(canonical, channel, peerId, configHash);
```

Request body sent by wrapper:

```json
{
  "action": "link",
  "canonical": "main",
  "channel": "telegram",
  "peerId": "tg-main",
  "baseHash": "identity-hash-1"
}
```

## Unlink

```ts
await unlinkIdentityPeer(canonical, channel, peerId, configHash);
```

Request body sent by wrapper:

```json
{
  "action": "unlink",
  "canonical": "main",
  "channel": "telegram",
  "peerId": "tg-main",
  "baseHash": "identity-hash-1"
}
```

## Error And Drift Rules

- Missing `configHash` blocks mutation.
- Failed mutation refreshes the list so the visible hash stays backend-owned.
- Do not infer channel display names, trust, proofing, account ownership, or contact graph from the identity payload.
- Do not add direct Gateway calls from browser code.
