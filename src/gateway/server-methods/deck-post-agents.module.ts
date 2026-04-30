import type { GatewayMethodModule } from "../method-registry.js";
import { deckPostAgentsHandlers, deckPostAgentsMethodDefs } from "./deck/index.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "deck-post-agents",
  priority: 337,
  handlers: deckPostAgentsHandlers,
  methodDefs: deckPostAgentsMethodDefs,
};
