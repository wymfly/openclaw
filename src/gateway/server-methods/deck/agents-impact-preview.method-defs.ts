import type { GatewayMethodMetadataModule } from "../../method-registry.js";
import { deckAgentsImpactPreviewMethodDefs } from "./agents-impact-preview.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "deck-agents-impact-preview",
  priority: 83,
  methodDefs: deckAgentsImpactPreviewMethodDefs,
};
