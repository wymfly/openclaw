import type { GatewayMethodMetadataModule } from "../../method-registry.js";
import { deckAgentsSystemPromptPreviewMethodDefs } from "./agents-preview-system-prompt.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "deck-agents-preview-system-prompt",
  priority: 86,
  methodDefs: deckAgentsSystemPromptPreviewMethodDefs,
};
