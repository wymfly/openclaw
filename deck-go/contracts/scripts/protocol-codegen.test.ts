import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Type } from "@sinclair/typebox";
import { schemaToTS, sortedEntries } from "./protocol-common.js";

assert.deepEqual(sortedEntries({ beta: 2, alpha: 1, gamma: 3 }), [
  ["alpha", 1],
  ["beta", 2],
  ["gamma", 3],
]);

const rendered = schemaToTS(
  Type.Object({
    zed: Type.String(),
    alpha: Type.Number(),
    record: Type.Record(Type.String(), Type.Boolean()),
  }),
);
assert.match(rendered, /alpha: number;/);
assert.ok(rendered.indexOf("alpha: number;") < rendered.indexOf("record:"));
assert.ok(rendered.indexOf("record:") < rendered.indexOf("zed: string;"));

assert.equal(schemaToTS(Type.Union([Type.Literal("last"), Type.String()])), "string");
assert.equal(
  schemaToTS(Type.Union([Type.Literal("current"), Type.Literal("main"), Type.String()])),
  "string",
);

const generatedGoTypes = readFileSync(
  resolve("deck-go/backend/internal/gateway/generated/types_extra_2.go"),
  "utf8",
);
assert.match(
  generatedGoTypes,
  /SubagentControlScope string\s+`json:"subagentControlScope,omitempty"`/,
);
assert.match(generatedGoTypes, /SubagentRole\s+string\s+`json:"subagentRole,omitempty"`/);
assert.doesNotMatch(generatedGoTypes, /Subagent(ControlScope|Role)\s+any/);

console.log("deck-go protocol codegen helper assertions passed");
