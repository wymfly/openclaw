import { isDataFabricError } from "./error-types";

const RETRYABLE_READ_KINDS = new Set(["network", "timeout", "rate-limit", "server"]);

export function controlledReadRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2 || !isDataFabricError(error)) {
    return false;
  }
  return RETRYABLE_READ_KINDS.has(error.kind);
}
