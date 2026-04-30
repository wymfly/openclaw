import type { GatewayMethodMetadataModule } from "../../method-registry.js";
import { deckRoutingListMethodDefs } from "./routing-list.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "deck-routing-list",
  priority: 80.1,
  methodDefs: deckRoutingListMethodDefs,
};
