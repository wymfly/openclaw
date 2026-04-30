import type { GatewayMethodModule } from "../method-registry.js";
import { deckPreAgentsHandlers, deckPreAgentsMethodDefs } from "./deck/index.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "deck",
  priority: 330,
  handlers: deckPreAgentsHandlers,
  methodDefs: deckPreAgentsMethodDefs,
};
