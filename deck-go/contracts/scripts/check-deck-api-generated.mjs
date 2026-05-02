import fs from "node:fs/promises";
import { renderDeckApiArtifacts } from "./deck-api-codegen.mjs";

const root = new URL("../", import.meta.url);
const sourcePath = new URL("source/deck-api.contract.ts", root);
const tsOutPath = new URL("generated/ts/deck-api.generated.ts", root);
const goOutPath = new URL("../backend/internal/deckapi/types.generated.go", root);

const source = await fs.readFile(sourcePath, "utf8");
const expected = renderDeckApiArtifacts(source);

const [tsActual, goActual] = await Promise.all([
  fs.readFile(tsOutPath, "utf8"),
  fs.readFile(goOutPath, "utf8"),
]);

if (tsActual !== expected.ts) {
  console.error(
    "deck-api.generated.ts is stale. Run: node contracts/scripts/sync-deck-api-generated.mjs",
  );
  process.exit(1);
}

if (goActual !== expected.go) {
  console.error(
    "types.generated.go is stale. Run: node contracts/scripts/sync-deck-api-generated.mjs",
  );
  process.exit(1);
}

console.log("deck-api generated artifacts are up to date");
