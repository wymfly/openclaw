/**
 * Standalone entry point — preloads sql.js WASM before starting the Next.js server.
 * Workaround for instrumentation.ts not being included in standalone production builds.
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Preload sql.js before any route handler runs
async function preload() {
  const initSqlJs = (await import("sql.js")).default;
  const wasmPath = path.join(__dirname, "..", "node_modules", "sql.js", "dist", "sql-wasm.wasm");
  if (!fs.existsSync(wasmPath)) {
    console.error(`[standalone-entry] sql-wasm.wasm not found at ${wasmPath}`);
    process.exit(1);
  }
  const buf = fs.readFileSync(wasmPath);
  const engine = await initSqlJs({
    wasmBinary: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  });
  // Store on globalThis with the same key used by server/db.ts
  globalThis.__sqljs_engine__ = engine;
}

await preload();
console.log("[standalone-entry] sql.js preloaded");

// Now start the actual Next.js server
await import("./server.js");
