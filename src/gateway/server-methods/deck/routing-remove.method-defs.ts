import type { GatewayMethodMetadataModule } from "../../method-registry.js";
import { deckRoutingRemoveMethodDefs } from "./routing-remove.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "deck-routing-remove",
  priority: 80.3,
  methodDefs: deckRoutingRemoveMethodDefs,
};
