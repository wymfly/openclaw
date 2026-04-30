import type { GatewayMethodModule } from "../../method-registry.js";
import {
  deckAgentsSystemPromptPreviewHandlers,
  deckAgentsSystemPromptPreviewMethodDefs,
} from "./agents-preview-system-prompt.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "deck-agents-preview-system-prompt",
  priority: 336,
  handlers: deckAgentsSystemPromptPreviewHandlers,
  methodDefs: deckAgentsSystemPromptPreviewMethodDefs,
};
