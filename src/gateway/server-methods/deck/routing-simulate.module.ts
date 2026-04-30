import type { GatewayMethodModule } from "../../method-registry.js";
import { deckRoutingSimulateHandlers, deckRoutingSimulateMethodDefs } from "./routing-simulate.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "deck-routing-simulate",
  priority: 330.5,
  handlers: deckRoutingSimulateHandlers,
  methodDefs: deckRoutingSimulateMethodDefs,
};
