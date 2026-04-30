import type { GatewayMethodModule } from "../../method-registry.js";
import {
  deckAgentsToolPolicyPreviewHandlers,
  deckAgentsToolPolicyPreviewMethodDefs,
} from "./agents-preview-tool-policy.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "deck-agents-preview-tool-policy",
  priority: 335,
  handlers: deckAgentsToolPolicyPreviewHandlers,
  methodDefs: deckAgentsToolPolicyPreviewMethodDefs,
};
