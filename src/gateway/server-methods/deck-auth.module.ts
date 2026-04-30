import type { GatewayMethodModule } from "../method-registry.js";
import { deckAuthHandlers, deckAuthMethodDefs } from "./deck-auth.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "deck-auth",
  priority: 320,
  handlers: deckAuthHandlers,
  methodDefs: deckAuthMethodDefs,
};
