import type { GatewayMethodModule } from "../../method-registry.js";
import {
  deckAgentsImpactPreviewHandlers,
  deckAgentsImpactPreviewMethodDefs,
} from "./agents-impact-preview.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "deck-agents-impact-preview",
  priority: 333,
  handlers: deckAgentsImpactPreviewHandlers,
  methodDefs: deckAgentsImpactPreviewMethodDefs,
};
