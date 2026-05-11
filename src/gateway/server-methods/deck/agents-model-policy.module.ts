import type { GatewayMethodModule } from "../../method-registry.js";
import {
  deckAgentsModelPolicyHandlers,
  deckAgentsModelPolicyMethodDefs,
} from "./agents-model-policy.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "deck-agents-model-policy",
  priority: 332.5,
  handlers: deckAgentsModelPolicyHandlers,
  methodDefs: deckAgentsModelPolicyMethodDefs,
};
