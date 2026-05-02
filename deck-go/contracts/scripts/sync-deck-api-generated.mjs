import fs from "node:fs/promises";
import path from "node:path";
import { renderDeckApiArtifacts } from "./deck-api-codegen.mjs";

const root = new URL("../", import.meta.url);
const sourcePath = new URL("source/deck-api.contract.ts", root);
const tsOutPath = new URL("generated/ts/deck-api.generated.ts", root);
const goOutPath = new URL("../backend/internal/deckapi/types.generated.go", root);

const source = await fs.readFile(sourcePath, "utf8");
const artifacts = renderDeckApiArtifacts(source);

await fs.mkdir(path.dirname(tsOutPath.pathname), { recursive: true });
await fs.writeFile(tsOutPath, artifacts.ts, "utf8");
await fs.writeFile(goOutPath, artifacts.go, "utf8");

console.log(`wrote ${tsOutPath.pathname}`);
console.log(`wrote ${goOutPath.pathname}`);
