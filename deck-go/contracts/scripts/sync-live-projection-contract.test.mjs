import assert from "node:assert/strict";
import {
  collectEndpointKeys,
  collectStreamEvents,
  normalizeEndpointKey,
  renderTypescript,
  validateLiveProjectionContract,
} from "./sync-live-projection-contract.mjs";

const endpointContract = {
  endpoints: [
    { paths: ["GET /stream", "GET /logs/stream", "GET /activity", "GET /deck/agents?agentId=..."] },
  ],
};

const streamContract = {
  streams: [
    {
      endpoint: "GET /stream",
      events: [{ event: "projection.gap" }, { event: "activity.event" }],
    },
    {
      endpoint: "GET /logs/stream",
      events: [{ event: "log.batch" }],
    },
  ],
};

function validContract() {
  return {
    schemaVersion: 1,
    metadataSourceFormat: "deck-live-projections-json",
    statusValues: ["idle", "connecting", "connected", "reconnecting", "stale", "error"],
    gapPolicies: ["none", "mark-stale", "refresh"],
    streams: [
      {
        id: "deck-main",
        endpoint: "GET /stream",
        transport: "sse",
        lastEventId: true,
        gapEvent: "projection.gap",
      },
    ],
    projections: [
      {
        id: "activity-feed",
        panel: "activity",
        stream: "deck-main",
        events: ["activity.event", "projection.gap"],
        refreshEndpoints: ["GET /activity"],
        staleAfterMs: 30000,
        gapPolicy: "refresh",
        cursorStorageKey: "deckGoLiveProjection:activity-feed:lastEventId",
      },
    ],
  };
}

const context = {
  endpointKeys: collectEndpointKeys(endpointContract),
  streamEvents: collectStreamEvents(streamContract),
};

assert.equal(normalizeEndpointKey("GET /deck/agents?agentId=..."), "GET /api/deck/agents");
assert.deepEqual(validateLiveProjectionContract(validContract(), context), []);

{
  const contract = validContract();
  contract.projections[0].events = ["missing.event"];
  const issues = validateLiveProjectionContract(contract, context);
  assert.equal(issues.length, 2);
  assert.match(issues[0].message, /event is not declared/);
  assert.match(issues[1].message, /requires event projection\.gap/);
}

{
  const contract = validContract();
  contract.projections[0].refreshEndpoints = ["GET /unknown"];
  const issues = validateLiveProjectionContract(contract, context);
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /unknown refresh endpoint/);
}

{
  const source = renderTypescript(validContract());
  assert.match(source, /deckGoLiveProjectionContract/);
  assert.match(source, /DeckGoLiveProjectionId/);
}

console.log("sync-live-projection-contract tests passed");
