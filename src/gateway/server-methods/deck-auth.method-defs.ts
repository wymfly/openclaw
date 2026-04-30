import type { GatewayMethodMetadataModule } from "../method-registry.js";
import { deckAuthMethodDefs } from "./deck-auth.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "deck-auth",
  priority: 90,
  methodDefs: deckAuthMethodDefs,
};
