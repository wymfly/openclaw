import type { MethodMetadata } from "../../method-registry.js";
import type { GatewayRequestHandlers } from "../types.js";
import { deckRoutingAddHandlers, deckRoutingAddMethodDefs } from "./routing-add.js";
import { deckRoutingListHandlers, deckRoutingListMethodDefs } from "./routing-list.js";
import { deckRoutingRemoveHandlers, deckRoutingRemoveMethodDefs } from "./routing-remove.js";
import { deckRoutingSimulateHandlers, deckRoutingSimulateMethodDefs } from "./routing-simulate.js";
import { deckRoutingValidateHandlers, deckRoutingValidateMethodDefs } from "./routing-validate.js";

export const deckRoutingHandlers: GatewayRequestHandlers = {
  ...deckRoutingListHandlers,
  ...deckRoutingAddHandlers,
  ...deckRoutingRemoveHandlers,
  ...deckRoutingValidateHandlers,
  ...deckRoutingSimulateHandlers,
};

export const deckRoutingMethodDefs: Record<string, MethodMetadata> = {
  ...deckRoutingListMethodDefs,
  ...deckRoutingAddMethodDefs,
  ...deckRoutingRemoveMethodDefs,
  ...deckRoutingValidateMethodDefs,
  ...deckRoutingSimulateMethodDefs,
};
