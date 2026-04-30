import {
  ErrorCodes,
  type ErrorShape,
  errorShape,
  formatValidationErrors,
  type GatewayBatchParams,
  type GatewayBatchResult,
  type RequestFrame,
  validateGatewayBatchParams,
} from "../protocol/index.js";
import type { DispatchGatewaySubRequest, GatewayRequestHandlers } from "./types.js";

type BatchCall = GatewayBatchParams["calls"][number];
type BatchResultEntry = GatewayBatchResult["results"][number];

function rejectedMethodError(method: string): ErrorShape | null {
  if (method === "gateway.batch") {
    return errorShape(ErrorCodes.INVALID_REQUEST, "gateway.batch cannot include gateway.batch");
  }
  if (/\.(subscribe|unsubscribe)$/.test(method)) {
    return errorShape(
      ErrorCodes.INVALID_REQUEST,
      `gateway.batch does not support subscription method: ${method}`,
    );
  }
  return null;
}

function formatThrownError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return String(error);
}

async function dispatchBatchCall(
  call: BatchCall,
  batchId: string,
  dispatchSubRequest: DispatchGatewaySubRequest,
): Promise<BatchResultEntry> {
  let settled = false;
  let entry: BatchResultEntry | undefined;

  const req: RequestFrame = {
    type: "req",
    id: call.id,
    method: call.method,
    params: call.params,
  };

  try {
    await dispatchSubRequest({
      req,
      batchId,
      respond: (ok, result, error) => {
        if (settled) {
          return;
        }
        settled = true;
        entry = ok
          ? { id: call.id, ok: true, result }
          : {
              id: call.id,
              ok: false,
              error:
                error ??
                errorShape(ErrorCodes.UNAVAILABLE, `sub-call ${call.method} failed without error`),
            };
      },
    });
  } catch (error) {
    if (!settled) {
      settled = true;
      entry = {
        id: call.id,
        ok: false,
        error: errorShape(
          ErrorCodes.UNAVAILABLE,
          `sub-call ${call.method} threw: ${formatThrownError(error)}`,
        ),
      };
    }
  }

  return (
    entry ?? {
      id: call.id,
      ok: false,
      error: errorShape(ErrorCodes.UNAVAILABLE, `sub-call ${call.method} did not respond`),
    }
  );
}

export const gatewayBatchHandlers: GatewayRequestHandlers = {
  "gateway.batch": async ({ req, params, respond, dispatchSubRequest }) => {
    if (!validateGatewayBatchParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid gateway.batch params: ${formatValidationErrors(validateGatewayBatchParams.errors)}`,
        ),
      );
      return;
    }

    if (!dispatchSubRequest) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "gateway.batch dispatcher is unavailable"),
      );
      return;
    }

    const results: BatchResultEntry[] = [];
    for (const call of params.calls) {
      const rejected = rejectedMethodError(call.method);
      const entry = rejected
        ? { id: call.id, ok: false, error: rejected }
        : await dispatchBatchCall(call, req.id, dispatchSubRequest);
      results.push(entry);
      if (!entry.ok && params.options?.failFast) {
        break;
      }
    }

    respond(true, { results });
  },
};
