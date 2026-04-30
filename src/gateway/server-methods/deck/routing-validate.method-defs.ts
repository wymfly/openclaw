import type { GatewayMethodMetadataModule } from "../../method-registry.js";
import { deckRoutingValidateMethodDefs } from "./routing-validate.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "deck-routing-validate",
  priority: 80.4,
  methodDefs: deckRoutingValidateMethodDefs,
};
