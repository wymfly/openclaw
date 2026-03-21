// ---------------------------------------------------------------------------
// Per-session AbortController management.
//
// Each session gets its own AbortController so that switching sessions or
// cancelling a request only affects the target session's in-flight fetch,
// not every active stream.
// ---------------------------------------------------------------------------

const sessionAbortControllers = new Map<string, AbortController>();

/**
 * Return the AbortController for `sessionKey`, creating one lazily.
 *
 * Callers pass `getSessionAbort(key).signal` to fetch / SSE requests so
 * they can be cancelled individually via `abortSession(key)`.
 */
export function getSessionAbort(sessionKey: string): AbortController {
  let ctrl = sessionAbortControllers.get(sessionKey);
  if (!ctrl) {
    ctrl = new AbortController();
    sessionAbortControllers.set(sessionKey, ctrl);
  }
  return ctrl;
}

/**
 * Abort any in-flight request for `sessionKey` and remove its controller.
 *
 * The next call to `getSessionAbort` for the same key will create a fresh
 * (non-aborted) controller — safe for immediate reuse.
 */
export function abortSession(sessionKey: string): void {
  sessionAbortControllers.get(sessionKey)?.abort();
  sessionAbortControllers.delete(sessionKey);
}
