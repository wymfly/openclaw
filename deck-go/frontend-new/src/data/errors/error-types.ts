export type DataFabricErrorKind =
  | "auth"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "validation"
  | "rate-limit"
  | "server"
  | "network"
  | "timeout"
  | "aborted"
  | "unknown";

export type DataFabricErrorMetadata = {
  baseHash?: string;
  currentHash?: string;
  requestId?: string;
  status?: number;
  traceId?: string;
  upstreamCode?: string;
};

export class DataFabricError extends Error {
  readonly baseHash?: string;
  readonly currentHash?: string;
  readonly kind: DataFabricErrorKind;
  readonly requestId?: string;
  readonly status?: number;
  readonly traceId?: string;
  readonly upstreamCode?: string;

  constructor(params: {
    cause?: unknown;
    kind: DataFabricErrorKind;
    message: string;
    metadata?: DataFabricErrorMetadata;
  }) {
    super(params.message, { cause: params.cause });
    this.name = "DataFabricError";
    this.kind = params.kind;
    this.baseHash = params.metadata?.baseHash;
    this.currentHash = params.metadata?.currentHash;
    this.requestId = params.metadata?.requestId;
    this.status = params.metadata?.status;
    this.traceId = params.metadata?.traceId;
    this.upstreamCode = params.metadata?.upstreamCode;
  }
}

export function isDataFabricError(error: unknown): error is DataFabricError {
  return error instanceof DataFabricError;
}
