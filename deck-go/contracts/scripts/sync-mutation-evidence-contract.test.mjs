import assert from "node:assert/strict";
import {
  collectDeckApiTypes,
  collectEndpointKeys,
  normalizeEndpointKey,
  renderTypescript,
  validateMutationEvidenceContract,
} from "./sync-mutation-evidence-contract.mjs";

const endpointKeys = collectEndpointKeys({
  endpoints: [{ paths: ["POST /usage/budget", "DELETE /usage/budget/{id}"] }],
});
const deckApiTypes = collectDeckApiTypes(`
export type DeckGoBudgetRule = {}
`);

function validContract() {
  return {
    schemaVersion: 1,
    metadataSourceFormat: "deck-mutations-json",
    actions: [
      {
        id: "budget.rule.create",
        ownerModule: "budget",
        route: "POST /usage/budget",
        sourceClassification: "deck-local",
        responseDto: "DeckGoBudgetRule",
        successIndicator: { path: "id", expected: "present" },
        targetId: { source: "response", path: "id" },
        auditCoverage: { mode: "process-memory", source: "deck-go-control-audit-history-contract" },
        idempotency: "unsupported",
        conflictBehavior: "validation-only",
        fixtureSafety: {
          status: "fixture-safe",
          evidence: ["deck-go/test/e2e/budget-real-gateway.spec.ts"],
          notes: "run scoped",
        },
      },
    ],
    deferredClasses: [
      {
        id: "agents.lifecycle-and-config",
        ownerModule: "agents",
        fixtureSafety: "deferred",
        reason: "module specific",
      },
    ],
  };
}

assert.equal(normalizeEndpointKey("POST /usage/budget?x=1"), "POST /api/usage/budget");
assert.deepEqual(
  validateMutationEvidenceContract(validContract(), {
    endpointKeys,
    deckApiTypes,
    fileExists: () => true,
  }),
  [],
);

{
  const contract = validContract();
  contract.actions[0].responseDto = "DeckGoMissing";
  const issues = validateMutationEvidenceContract(contract, {
    endpointKeys,
    deckApiTypes,
    fileExists: () => true,
  });
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /unknown DTO/);
}

{
  const contract = validContract();
  contract.actions[0].fixtureSafety.status = "unsafe";
  const issues = validateMutationEvidenceContract(contract, {
    endpointKeys,
    deckApiTypes,
    fileExists: () => true,
  });
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /unknown fixture safety/);
}

{
  const contract = validContract();
  contract.actions.push({ ...contract.actions[0] });
  const issues = validateMutationEvidenceContract(contract, {
    endpointKeys,
    deckApiTypes,
    fileExists: () => true,
  });
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /duplicate action id/);
}

{
  const source = renderTypescript(validContract());
  assert.match(source, /deckGoMutationEvidenceContract/);
  assert.match(source, /DeckGoMutationActionId/);
}

console.log("sync-mutation-evidence-contract tests passed");
