import assert from "node:assert/strict";
import { validateMetadata } from "./sync-ui-contract-metadata.mjs";

const dtoFields = new Map([
  ["DeckGoRuntimeGatewayStatus", new Set(["mode", "status"])],
  ["DeckGoRuntimeGatewayResponse", new Set(["runtime"])],
]);
const endpointKeys = new Set(["GET /api/runtime/gateway", "POST /api/runtime/gateway/stop"]);

const validMetadata = {
  schemaVersion: 1,
  metadataSourceFormat: "sibling-ui-contract-json",
  fieldKinds: ["status"],
  domains: [
    {
      id: "runtime-settings",
      label: "Runtime and settings",
      migrationStatus: "migrated",
      dtos: ["DeckGoRuntimeGatewayStatus"],
      endpoints: ["GET /api/runtime/gateway"],
      actions: ["runtime.gateway.refresh"],
    },
  ],
  fieldMetadata: [
    {
      dto: "DeckGoRuntimeGatewayStatus",
      field: "status",
      label: "Status",
      kind: "status",
      statusValues: {
        running: { label: "Running", tone: "success" },
      },
    },
  ],
  actions: [
    {
      id: "runtime.gateway.refresh",
      label: "Refresh runtime",
      endpoint: "GET /api/runtime/gateway",
      safety: "read",
      resultDto: "DeckGoRuntimeGatewayResponse",
    },
  ],
};

assert.deepEqual(validateMetadata(validMetadata, { dtoFields, endpointKeys }), []);

const invalidMetadata = {
  schemaVersion: 1,
  metadataSourceFormat: "sibling-ui-contract-json",
  fieldKinds: ["status"],
  domains: [
    {
      id: "runtime-settings",
      label: "Runtime and settings",
      migrationStatus: "migrated",
      dtos: ["DeckGoMissingDto"],
      endpoints: ["GET /api/missing"],
      actions: ["missing.action"],
    },
  ],
  fieldMetadata: [
    {
      dto: "DeckGoRuntimeGatewayStatus",
      field: "missing",
      label: "Broken",
      kind: "status",
    },
  ],
  actions: [
    {
      id: "runtime.gateway.stop",
      label: "Stop runtime",
      endpoint: "POST /api/runtime/gateway/stop",
      safety: "destructive",
      resultDto: "DeckGoMissingDto",
    },
  ],
};

const issues = validateMetadata(invalidMetadata, { dtoFields, endpointKeys });
assert(issues.some((entry) => entry.path.includes("dtos.DeckGoMissingDto")));
assert(issues.some((entry) => entry.path.includes("endpoints.GET /api/missing")));
assert(issues.some((entry) => entry.path.includes("actions.missing.action")));
assert(issues.some((entry) => entry.path === "fieldMetadata[0].field"));
assert(issues.some((entry) => entry.path === "fieldMetadata[0].statusValues"));
assert(issues.some((entry) => entry.path === "actions[0].resultDto"));
assert(issues.some((entry) => entry.path === "actions[0].confirmation"));

console.log("ui metadata assertions passed");
