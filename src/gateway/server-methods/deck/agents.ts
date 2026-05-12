import type { MethodMetadata } from "../../method-registry.js";
import type { GatewayRequestHandlers } from "../types.js";
import { deckAgentsDetailHandlers, deckAgentsDetailMethodDefs } from "./agents-detail.js";
import {
  deckAgentsEventStreamsHandlers,
  deckAgentsEventStreamsMethodDefs,
} from "./agents-event-streams.js";
import {
  deckAgentsImpactPreviewHandlers,
  deckAgentsImpactPreviewMethodDefs,
} from "./agents-impact-preview.js";
import {
  deckAgentsModelPolicyHandlers,
  deckAgentsModelPolicyMethodDefs,
} from "./agents-model-policy.js";
import { deckAgentsSkillsHandlers, deckAgentsSkillsMethodDefs } from "./agents-skills.js";
import {
  deckAgentsSubagentsConfigHandlers,
  deckAgentsSubagentsConfigMethodDefs,
} from "./agents-subagents-config.js";

export const deckAgentsHandlers: GatewayRequestHandlers = {
  ...deckAgentsDetailHandlers,
  ...deckAgentsSkillsHandlers,
  ...deckAgentsModelPolicyHandlers,
  ...deckAgentsImpactPreviewHandlers,
  ...deckAgentsSubagentsConfigHandlers,
  ...deckAgentsEventStreamsHandlers,
};

export const deckAgentsMethodDefs: Record<string, MethodMetadata> = {
  ...deckAgentsDetailMethodDefs,
  ...deckAgentsSkillsMethodDefs,
  ...deckAgentsModelPolicyMethodDefs,
  ...deckAgentsImpactPreviewMethodDefs,
  ...deckAgentsSubagentsConfigMethodDefs,
  ...deckAgentsEventStreamsMethodDefs,
};
