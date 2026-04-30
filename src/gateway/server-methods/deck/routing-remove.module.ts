import type { GatewayMethodModule } from "../../method-registry.js";
import { deckRoutingRemoveHandlers, deckRoutingRemoveMethodDefs } from "./routing-remove.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "deck-routing-remove",
  priority: 330.3,
  handlers: deckRoutingRemoveHandlers,
  methodDefs: deckRoutingRemoveMethodDefs,
};
