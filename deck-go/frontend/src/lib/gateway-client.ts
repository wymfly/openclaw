import {
  createGatewayClient,
  type GatewayClient,
  type GatewayRequestFn,
} from "../../../contracts/generated/ts/gateway/client";
import type {
  GatewayMethodMap,
  GatewayMethodName,
} from "../../../contracts/generated/ts/gateway/protocol";
import { deckFetch } from "./deck-client";

export type GatewayErrorPayload = {
  code?: string;
  message?: string;
  details?: unknown;
};

export type DeckGatewayTransportOptions = {
  accessToken?: string | null;
  requestId?: string;
  runtimeId?: string;
};

export class GatewayError<C extends string = string> extends Error {
  readonly kind = "gateway";
  readonly code: C;
  readonly details: unknown;
  readonly requestId?: string;
  readonly status: number;

  constructor(params: {
    code: C;
    details?: unknown;
    message: string;
    requestId?: string;
    status: number;
  }) {
    super(params.message);
    this.name = "GatewayError";
    this.code = params.code;
    this.details = params.details;
    this.requestId = params.requestId;
    this.status = params.status;
  }
}

export function isGatewayError(error: unknown): error is GatewayError {
  return (
    error instanceof GatewayError ||
    Boolean(error && (error as { kind?: unknown }).kind === "gateway")
  );
}

export function isGatewayScopeError(error: unknown): error is GatewayError<"scope_denied"> {
  return isGatewayError(error) && error.code === "scope_denied";
}

type GatewayRPCResponse<M extends GatewayMethodName> = {
  error?: GatewayErrorPayload;
  requestId?: string;
  result?: GatewayMethodMap[M]["result"];
  payload?: GatewayMethodMap[M]["result"];
};

type GatewayErrorEnvelope = {
  error?: GatewayErrorPayload;
  requestId?: string;
};

type GatewayBatchResponse = GatewayErrorEnvelope & {
  results?: Array<{
    id: string;
    ok: boolean;
    result?: unknown;
    error?: GatewayErrorPayload;
  }>;
};

export type BatchCallSpec<M extends GatewayMethodName = GatewayMethodName> =
  M extends GatewayMethodName
    ? {
        id: string;
        method: M;
        params: GatewayMethodMap[M]["params"];
      }
    : never;

export type BatchResultTuple<R extends readonly BatchCallSpec[]> = {
  [K in keyof R]: R[K] extends BatchCallSpec<infer M>
    ? GatewayMethodMap[M]["result"] | GatewayError
    : never;
};

export type DeckGatewayClient = GatewayClient & {
  batch<const R extends readonly BatchCallSpec[]>(
    calls: R,
    options?: { failFast?: boolean; timeoutMs?: number },
  ): Promise<BatchResultTuple<R>>;
};

function readRequestId(options: DeckGatewayTransportOptions) {
  if (options.requestId) {
    return options.requestId;
  }
  return globalThis.crypto?.randomUUID?.() ?? `deck-go-${Date.now()}`;
}

async function readGatewayRPCResponse<M extends GatewayMethodName>(
  response: Response,
): Promise<GatewayRPCResponse<M>> {
  try {
    return (await response.json()) as GatewayRPCResponse<M>;
  } catch {
    return {};
  }
}

function buildGatewayError(
  response: Response,
  envelope: GatewayErrorEnvelope,
  fallbackMessage: string,
) {
  const code = envelope.error?.code || (response.status === 403 ? "scope_denied" : "gateway_error");
  const message = envelope.error?.message || fallbackMessage;
  return new GatewayError({
    code,
    details: envelope.error?.details,
    message,
    requestId: envelope.requestId,
    status: response.status,
  });
}

async function readGatewayBatchResponse(response: Response): Promise<GatewayBatchResponse> {
  try {
    return (await response.json()) as GatewayBatchResponse;
  } catch {
    return {};
  }
}

function createBatchSlotError(
  response: Response,
  requestId: string | undefined,
  error: GatewayErrorPayload | undefined,
  fallbackMessage: string,
) {
  return new GatewayError({
    code: error?.code || "gateway_batch_error",
    details: error?.details,
    message: error?.message || fallbackMessage,
    requestId,
    status: response.status,
  });
}

function createDeckGatewayBatchTransport(options: DeckGatewayTransportOptions = {}) {
  const runtimeId = options.runtimeId ?? "rt_local";
  const requestId = readRequestId(options);

  return async <const R extends readonly BatchCallSpec[]>(
    calls: R,
    batchOptions?: { failFast?: boolean; timeoutMs?: number },
  ): Promise<BatchResultTuple<R>> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Request-Id": requestId,
    };
    const accessToken = options.accessToken?.trim();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await deckFetch(
      `/api/v1/runtimes/${encodeURIComponent(runtimeId)}/gateway/batch`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          calls,
          ...(batchOptions ? { options: batchOptions } : {}),
        }),
      },
      accessToken ? { token: accessToken } : undefined,
    );
    const envelope = await readGatewayBatchResponse(response);
    if (!response.ok || envelope.error) {
      throw buildGatewayError(response, envelope, "gateway.batch failed");
    }

    return (envelope.results ?? []).map((slot) => {
      if (slot.ok) {
        return slot.result;
      }
      return createBatchSlotError(
        response,
        envelope.requestId,
        slot.error,
        `gateway.batch sub-call ${slot.id} failed`,
      );
    }) as BatchResultTuple<R>;
  };
}

export function createDeckGatewayTransport(
  options: DeckGatewayTransportOptions = {},
): GatewayRequestFn {
  const runtimeId = options.runtimeId ?? "rt_local";
  const requestId = readRequestId(options);

  return async <M extends GatewayMethodName>(
    method: M,
    params: GatewayMethodMap[M]["params"],
    requestOptions?: { timeoutMs?: number },
  ): Promise<GatewayMethodMap[M]["result"]> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Request-Id": requestId,
    };
    const accessToken = options.accessToken?.trim();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await deckFetch(
      `/api/v1/runtimes/${encodeURIComponent(runtimeId)}/gateway/rpc`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          method,
          params,
          ...(requestOptions?.timeoutMs != null ? { timeoutMs: requestOptions.timeoutMs } : {}),
        }),
      },
      accessToken ? { token: accessToken } : undefined,
    );
    const envelope = await readGatewayRPCResponse<M>(response);
    if (!response.ok || envelope.error) {
      throw buildGatewayError(response, envelope, `${method} failed`);
    }
    if ("result" in envelope) {
      return envelope.result as GatewayMethodMap[M]["result"];
    }
    return envelope.payload as GatewayMethodMap[M]["result"];
  };
}

export function createDeckGatewayClient(
  options: DeckGatewayTransportOptions = {},
): DeckGatewayClient {
  return {
    ...createGatewayClient(createDeckGatewayTransport(options)),
    batch: createDeckGatewayBatchTransport(options),
  };
}
