import type { MethodMetadata } from "../../method-registry.js";
import type { GatewayRequestHandlers } from "../types.js";
import {
  deckAgentsSystemPromptPreviewHandlers,
  deckAgentsSystemPromptPreviewMethodDefs,
} from "./agents-preview-system-prompt.js";
import {
  deckAgentsToolPolicyPreviewHandlers,
  deckAgentsToolPolicyPreviewMethodDefs,
} from "./agents-preview-tool-policy.js";

export const deckAgentsPreviewHandlers: GatewayRequestHandlers = {
  ...deckAgentsToolPolicyPreviewHandlers,
  ...deckAgentsSystemPromptPreviewHandlers,
};

export const deckAgentsPreviewMethodDefs: Record<string, MethodMetadata> = {
  ...deckAgentsToolPolicyPreviewMethodDefs,
  ...deckAgentsSystemPromptPreviewMethodDefs,
};
