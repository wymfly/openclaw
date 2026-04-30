import type { GatewayMethodMetadataModule } from "../../method-registry.js";
import { deckAgentsToolPolicyPreviewMethodDefs } from "./agents-preview-tool-policy.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "deck-agents-preview-tool-policy",
  priority: 85,
  methodDefs: deckAgentsToolPolicyPreviewMethodDefs,
};
