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
  envelope: GatewayRPCResponse<GatewayMethodName>,
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

export function createDeckGatewayClient(options: DeckGatewayTransportOptions = {}): GatewayClient {
  return createGatewayClient(createDeckGatewayTransport(options));
}
