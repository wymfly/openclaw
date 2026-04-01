/**
 * Next.js instrumentation hook — preloads sql.js WASM engine at server startup.
 * This ensures getDb()/openDb() can operate synchronously after init.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { preloadSqlJs } = await import("./server/db");
    await preloadSqlJs();
  }
}
