import { useMutation } from "@tanstack/react-query";
import { invokeGatewayMethod, submitGatewayBatch } from "@/api";
import type { DeckGoGatewayBatchRequest } from "@/api-types";
import { mutationDefaults } from "../shared";

export function useSubmitGatewayBatchMutation() {
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({
      request,
      runtimeId,
    }: {
      request: DeckGoGatewayBatchRequest;
      runtimeId?: string;
    }) => submitGatewayBatch(request, { runtimeId }),
  });
}

export function useInvokeGatewayMethodMutation() {
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({
      method,
      params,
      runtimeId,
      timeoutMs,
    }: {
      method: string;
      params: Record<string, unknown>;
      runtimeId?: string;
      timeoutMs?: number;
    }) => invokeGatewayMethod(method, params, { runtimeId, timeoutMs }),
  });
}
