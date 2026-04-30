import type { GatewayMethodMetadataModule } from "../../method-registry.js";
import { deckAgentsDetailMethodDefs } from "./agents-detail.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "deck-agents-detail",
  priority: 81,
  methodDefs: deckAgentsDetailMethodDefs,
};
