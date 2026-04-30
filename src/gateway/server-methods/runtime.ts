import { buildMethodRegistry, loadGatewayMethodModules } from "../method-registry.js";
import { gatewayMethodModules } from "./_modules.generated.js";
import { setDescribeRegistry } from "./describe.js";
import { dispatchGatewayRequest } from "./dispatcher.js";
import type { GatewayRequestHandlers, GatewayRequestOptions } from "./types.js";

const loadedGatewayMethods = loadGatewayMethodModules(gatewayMethodModules);

export const coreGatewayHandlers: GatewayRequestHandlers = loadedGatewayMethods.handlers;

export const gatewayMethodRegistry = buildMethodRegistry(
  coreGatewayHandlers,
  [loadedGatewayMethods.methodDefs],
  loadedGatewayMethods.events,
);

export const CONTROL_PLANE_WRITE_METHODS = new Set(
  gatewayMethodRegistry
    .listMethods()
    .filter((method) => gatewayMethodRegistry.getDefinition(method)?.controlPlaneWrite === true),
);

setDescribeRegistry(gatewayMethodRegistry);

export async function handleGatewayRequest(
  opts: GatewayRequestOptions & { extraHandlers?: GatewayRequestHandlers },
): Promise<void> {
  const handlers = opts.extraHandlers
    ? { ...coreGatewayHandlers, ...opts.extraHandlers }
    : coreGatewayHandlers;
  await dispatchGatewayRequest({
    ...opts,
    handlers,
    controlPlaneWriteMethods: CONTROL_PLANE_WRITE_METHODS,
  });
}
