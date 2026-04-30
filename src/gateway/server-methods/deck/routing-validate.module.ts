import type { GatewayMethodModule } from "../../method-registry.js";
import { deckRoutingValidateHandlers, deckRoutingValidateMethodDefs } from "./routing-validate.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "deck-routing-validate",
  priority: 330.4,
  handlers: deckRoutingValidateHandlers,
  methodDefs: deckRoutingValidateMethodDefs,
};
