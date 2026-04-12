/**
 * Standalone entry point — starts the Next.js server.
 * Previously preloaded sql.js WASM; now all persistence uses JSON files.
 */

// Start the actual Next.js server
await import("./server.js");
