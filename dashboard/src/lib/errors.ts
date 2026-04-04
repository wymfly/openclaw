export enum GatewayErrorCode {
  GATEWAY_ERROR = "GATEWAY_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
  RATE_LIMITED = "RATE_LIMITED",
  NOT_CONFIGURED = "NOT_CONFIGURED",
  VALIDATION = "VALIDATION",
  INTERNAL = "INTERNAL",
}

export type ErrorBody = {
  error: string;
  code?: string;
  detail?: string;
};

export class DeckApiError extends Error {
  readonly code: GatewayErrorCode | string;
  readonly status: number;
  readonly body: ErrorBody;

  constructor(code: GatewayErrorCode | string, status: number, body: ErrorBody) {
    super(body.detail ?? body.error);
    this.name = "DeckApiError";
    this.code = code;
    this.status = status;
    this.body = body;
  }
}

export function statusToCode(status: number): GatewayErrorCode {
  switch (status) {
    case 401:
      return GatewayErrorCode.UNAUTHORIZED;
    case 429:
      return GatewayErrorCode.RATE_LIMITED;
    case 503:
      return GatewayErrorCode.NOT_CONFIGURED;
    case 400:
    case 422:
      return GatewayErrorCode.VALIDATION;
    default:
      return GatewayErrorCode.GATEWAY_ERROR;
  }
}

async function parseErrorBody(response: Response): Promise<ErrorBody> {
  try {
    const body = (await response.json()) as Partial<ErrorBody>;
    if (typeof body.error === "string") {
      return {
        error: body.error,
        code: typeof body.code === "string" ? body.code : undefined,
        detail: typeof body.detail === "string" ? body.detail : undefined,
      };
    }
  } catch {}

  return {
    error: response.statusText || "Request failed",
  };
}

export async function fetchApi<T>(url: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed";
    throw new DeckApiError(GatewayErrorCode.INTERNAL, 0, { error: message });
  }

  if (!response.ok) {
    const body = await parseErrorBody(response);
    const code = body.code ?? statusToCode(response.status);
    throw new DeckApiError(code, response.status, body);
  }

  return (await response.json()) as T;
}
