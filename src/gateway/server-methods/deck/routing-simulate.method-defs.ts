import type { GatewayMethodMetadataModule } from "../../method-registry.js";
import { deckRoutingSimulateMethodDefs } from "./routing-simulate.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "deck-routing-simulate",
  priority: 80.5,
  methodDefs: deckRoutingSimulateMethodDefs,
};
