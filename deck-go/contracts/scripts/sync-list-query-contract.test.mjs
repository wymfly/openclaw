import assert from "node:assert/strict";
import {
  collectDeckApiTypes,
  collectEndpointKeys,
  normalizeEndpointKey,
  renderTypescript,
  validateListQueryContract,
} from "./sync-list-query-contract.mjs";

const endpointKeys = collectEndpointKeys({
  endpoints: [{ paths: ["GET /logs", "GET /monitor/runs"] }],
});
const deckApiTypes = collectDeckApiTypes(`
export interface DeckGoLogsTailResponse {}
export type DeckGoMonitorRunsResponse = {}
`);

function validContract() {
  return {
    schemaVersion: 1,
    metadataSourceFormat: "deck-list-queries-json",
    paginationModes: ["bounded", "cursor", "offset", "filter-only"],
    parameterKinds: [
      "limit",
      "cursor",
      "offset",
      "search",
      "sort",
      "filter",
      "date-range",
      "include",
      "transport",
    ],
    queries: [
      {
        id: "logs-tail",
        endpoint: "GET /logs",
        paginationMode: "cursor",
        responseDto: "DeckGoLogsTailResponse",
        collectionField: "lines",
        cursorField: "cursor",
        defaultLimit: 200,
        maxLimit: 500,
        parameters: [
          { id: "cursor", param: "cursor", kind: "cursor", type: "number" },
          { id: "limit", param: "limit", kind: "limit", type: "number" },
        ],
      },
    ],
  };
}

assert.equal(normalizeEndpointKey("GET /monitor/runs?limit=10"), "GET /api/monitor/runs");
assert.deepEqual(validateListQueryContract(validContract(), { endpointKeys, deckApiTypes }), []);

{
  const contract = validContract();
  contract.queries[0].cursorField = null;
  const issues = validateListQueryContract(contract, { endpointKeys, deckApiTypes });
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /requires cursorField/);
}

{
  const contract = validContract();
  contract.queries[0].parameters[0].type = "object";
  const issues = validateListQueryContract(contract, { endpointKeys, deckApiTypes });
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /unknown parameter type/);
}

{
  const source = renderTypescript(validContract());
  assert.match(source, /deckGoListQueryContract/);
  assert.match(source, /DeckGoListQueryId/);
}

console.log("sync-list-query-contract tests passed");
