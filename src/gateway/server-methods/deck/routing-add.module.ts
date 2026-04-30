import type { GatewayMethodModule } from "../../method-registry.js";
import { deckRoutingAddHandlers, deckRoutingAddMethodDefs } from "./routing-add.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "deck-routing-add",
  priority: 330.2,
  handlers: deckRoutingAddHandlers,
  methodDefs: deckRoutingAddMethodDefs,
};
