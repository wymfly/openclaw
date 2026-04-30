import type { GatewayMethodModule } from "../../method-registry.js";
import { deckAgentsDetailHandlers, deckAgentsDetailMethodDefs } from "./agents-detail.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "deck-agents-detail",
  priority: 331,
  handlers: deckAgentsDetailHandlers,
  methodDefs: deckAgentsDetailMethodDefs,
};
