import { ControlPlaneGatewayError } from "@server/gateway-adapter";
import { getRuntime } from "@server/runtime";
import type { GatewayMethodMap, GatewayMethodName } from "@/types/gateway-protocol.generated";
const CAPABILITY_BOOTSTRAP_WAIT_MS = 750;

async function waitForCapabilityBootstrap(
  runtime: NonNullable<ReturnType<typeof getRuntime>>,
): Promise<void> {
  if (runtime.capabilities.status !== "pending") {
    return;
  }
  await Promise.race([
    runtime.capabilities.ready,
    new Promise<void>((resolve) => {
      setTimeout(resolve, CAPABILITY_BOOTSTRAP_WAIT_MS);
    }),
  ]);
}

async function ensureRuntimeCompatibility(
  runtime: NonNullable<ReturnType<typeof getRuntime>>,
): Promise<string | null> {
  await waitForCapabilityBootstrap(runtime);
  if (runtime.capabilities.status !== "incompatible") {
    return null;
  }
  return runtime.capabilities.reason ?? "Gateway is incompatible with this Deck build";
}

/** Send a typed RPC request through the Gateway adapter and return raw data. */
export async function gwCall<M extends GatewayMethodName>(
  method: M,
  params: GatewayMethodMap[M]["params"],
  options?: { timeoutMs?: number },
): Promise<GatewayMethodMap[M]["result"]> {
  const runtime = getRuntime();
  if (!runtime) {
    throw new ControlPlaneGatewayError({
      code: "GATEWAY_UNAVAILABLE",
      message: "Gateway not configured",
    });
  }
  const incompatibleReason = await ensureRuntimeCompatibility(runtime);
  if (incompatibleReason) {
    throw new ControlPlaneGatewayError({
      code: "GATEWAY_INCOMPATIBLE",
      message: incompatibleReason,
    });
  }
  return runtime.adapter.request(method, params, options);
}
