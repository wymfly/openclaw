import { allEventNames } from "../method-registry-data.js";
import {
  buildMethodRegistry,
  loadGatewayMethodMetadataModules,
  loadGatewayMethodModules,
} from "../method-registry.js";
import { gatewayMethodMetadataModules } from "./_method-defs.generated.js";
import { gatewayMethodModules } from "./_modules.generated.js";
import { setDescribeRegistry } from "./describe.js";
import { dispatchGatewayRequest } from "./dispatcher.js";
import type { GatewayRequestHandlers, GatewayRequestOptions } from "./types.js";

const loadedGatewayMethods = loadGatewayMethodModules(gatewayMethodModules);
const loadedGatewayMetadata = loadGatewayMethodMetadataModules(gatewayMethodMetadataModules);

const runtimeMetadataDefs = Object.fromEntries(
  Object.entries(loadedGatewayMetadata.methodDefs).filter(([method]) =>
    Boolean(loadedGatewayMethods.handlers[method]),
  ),
);
const runtimeEventDefs = {
  ...Object.fromEntries(allEventNames.map((eventName) => [eventName, {}])),
  ...loadedGatewayMetadata.events,
};

export const coreGatewayHandlers: GatewayRequestHandlers = loadedGatewayMethods.handlers;

export const gatewayMethodRegistry = buildMethodRegistry(
  coreGatewayHandlers,
  [loadedGatewayMethods.methodDefs, runtimeMetadataDefs],
  runtimeEventDefs,
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
