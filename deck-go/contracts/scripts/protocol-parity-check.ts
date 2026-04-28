import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT, allowlistMethodNames, typedMethodNames } from "./protocol-common.js";

function extractProtocolMethods(path: string): string[] {
  const content = readFileSync(path, "utf8");
  const block = content.match(
    /export interface GatewayMethodMap \{([\s\S]*?)\n\}\n\nexport type GatewayMethodName/,
  );
  if (!block) {
    throw new Error(`Unable to find GatewayMethodMap in ${path}`);
  }
  return [...block[1].matchAll(/^  (?:"([^"]+)"|([A-Za-z_$][\w$]*)):/gm)]
    .map((match) => match[1] ?? match[2])
    .toSorted((a, b) => a.localeCompare(b));
}

function extractAllowlistMethods(path: string): string[] {
  const content = readFileSync(path, "utf8");
  const allowlistBlock = content.match(
    /GENERATED_METHOD_ALLOWLIST[\s\S]*?new Set\(\[([\s\S]*?)\]\)/,
  );
  if (!allowlistBlock) {
    throw new Error(`Unable to find GENERATED_METHOD_ALLOWLIST in ${path}`);
  }
  return [...allowlistBlock[1].matchAll(/"([^"]+)"/g)]
    .map((match) => match[1])
    .toSorted((a, b) => a.localeCompare(b));
}

const deckProtocol = resolve(REPO_ROOT, "deck-go/contracts/generated/ts/gateway/protocol.ts");
const deckClient = resolve(REPO_ROOT, "deck-go/contracts/generated/ts/gateway/client.ts");
const dashboardProtocol = resolve(REPO_ROOT, "dashboard/src/types/gateway-protocol.generated.ts");
const dashboardClient = resolve(REPO_ROOT, "dashboard/src/types/gateway-client.generated.ts");

assert.deepEqual(extractProtocolMethods(deckProtocol), typedMethodNames());
assert.deepEqual(extractProtocolMethods(dashboardProtocol), typedMethodNames());
assert.deepEqual(extractAllowlistMethods(deckClient), allowlistMethodNames());
assert.deepEqual(extractAllowlistMethods(dashboardClient), allowlistMethodNames());

console.log("deck-go Gateway generated protocol parity matches dashboard");
