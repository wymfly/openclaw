import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Type } from "@sinclair/typebox";
import { emitNamedTSType, schemaToTS, sortedEntries } from "./protocol-common.js";

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

assert.equal(
  schemaToTS(Type.Array(Type.Object({ id: Type.String(), createdAtMs: Type.Integer() }))),
  "{\n  createdAtMs: number;\n  id: string;\n}[]",
);

const objectArrayLines: string[] = [];
emitNamedTSType(
  objectArrayLines,
  "ApprovalListResult",
  Type.Array(Type.Object({ id: Type.String(), createdAtMs: Type.Integer() })),
);
assert.equal(
  objectArrayLines.join("\n"),
  "export type ApprovalListResult = {\n  createdAtMs: number;\n  id: string;\n}[];\n",
);
assert.doesNotMatch(objectArrayLines.join("\n"), /^export interface ApprovalListResult/m);

const generatedTsProtocol = readFileSync(
  resolve("deck-go/contracts/generated/ts/gateway/protocol.ts"),
  "utf8",
);
assert.match(generatedTsProtocol, /export interface LogsTailResult \{[\s\S]*lines: string\[\];/);
assert.match(
  generatedTsProtocol,
  /export type SessionsUsageLogsResult = \{[\s\S]*content: string;/,
);
assert.match(
  generatedTsProtocol,
  /export interface SessionsUsageTimeseriesResult \{[\s\S]*points: \{/,
);
assert.doesNotMatch(generatedTsProtocol, /SessionsUsageLogsResult \{[\s\S]*logs: unknown\[\];/);
assert.doesNotMatch(generatedTsProtocol, /export type SessionsUsageTimeseriesResult = unknown;/);

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
