import type { GatewayMethodMetadataModule } from "../../method-registry.js";
import { deckAgentsModelPolicyMethodDefs } from "./agents-model-policy.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "deck-agents-model-policy",
  priority: 82.5,
  methodDefs: deckAgentsModelPolicyMethodDefs,
};
