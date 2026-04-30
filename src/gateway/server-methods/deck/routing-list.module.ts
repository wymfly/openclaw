import type { GatewayMethodModule } from "../../method-registry.js";
import { deckRoutingListHandlers, deckRoutingListMethodDefs } from "./routing-list.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "deck-routing-list",
  priority: 330.1,
  handlers: deckRoutingListHandlers,
  methodDefs: deckRoutingListMethodDefs,
};
