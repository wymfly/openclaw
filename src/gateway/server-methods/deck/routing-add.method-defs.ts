import type { GatewayMethodMetadataModule } from "../../method-registry.js";
import { deckRoutingAddMethodDefs } from "./routing-add.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "deck-routing-add",
  priority: 80.2,
  methodDefs: deckRoutingAddMethodDefs,
};
