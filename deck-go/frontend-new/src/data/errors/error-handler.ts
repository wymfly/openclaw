import { GatewayError, isGatewayError } from "../../lib/gateway-client";
import {
  DataFabricError,
  type DataFabricErrorKind,
  type DataFabricErrorMetadata,
} from "./error-types";

function readDetailString(details: unknown, key: string): string | undefined {
  if (!details || typeof details !== "object") {
    return undefined;
  }
  const value = (details as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function kindFromStatus(status: number | undefined, message: string): DataFabricErrorKind {
  if (status === 401 || /authentication token|unauthorized/i.test(message)) {
    return "auth";
  }
  if (status === 403) {
    return "forbidden";
  }
  if (status === 404) {
    return "not-found";
  }
  if (status === 409) {
    return "conflict";
  }
  if (status === 400 || status === 422) {
    return "validation";
  }
  if (status === 429) {
    return "rate-limit";
  }
  if (status != null && status >= 500) {
    return "server";
  }
  return "unknown";
}

function gatewayMetadata(error: GatewayError): DataFabricErrorMetadata {
  return {
    baseHash: readDetailString(error.details, "baseHash"),
    currentHash: readDetailString(error.details, "currentHash"),
    requestId: error.requestId,
    status: error.status,
    traceId: readDetailString(error.details, "traceId"),
    upstreamCode: error.code,
  };
}

export function normalizeDataFabricError(error: unknown): DataFabricError {
  if (error instanceof DataFabricError) {
    return error;
  }
  if (isGatewayError(error)) {
    return new DataFabricError({
      cause: error,
      kind: kindFromStatus(error.status, error.message),
      message: error.message,
      metadata: gatewayMetadata(error),
    });
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return new DataFabricError({
      cause: error,
      kind: "aborted",
      message: error.message || "request aborted",
    });
  }
  if (error instanceof TypeError) {
    return new DataFabricError({
      cause: error,
      kind: "network",
      message: error.message || "network request failed",
    });
  }
  if (error instanceof Error) {
    return new DataFabricError({
      cause: error,
      kind: kindFromStatus(undefined, error.message),
      message: error.message,
    });
  }
  return new DataFabricError({
    cause: error,
    kind: "unknown",
    message: "unknown data fabric error",
  });
}
