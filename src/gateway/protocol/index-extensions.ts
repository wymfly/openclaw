import AjvPkg from "ajv";
import type { SessionsClearParams } from "./schema.js";
import {
  ModelsConfiguredParamsSchema,
  SessionsClearParamsSchema,
  TranscriptBlockSchema,
  TranscriptFileBlockSchema,
  TranscriptImageBlockSchema,
  TranscriptMessageSchema,
  TranscriptRoleSchema,
  TranscriptTextBlockSchema,
  TranscriptThinkingBlockSchema,
  TranscriptToolUseBlockSchema,
} from "./schema.js";
import {
  DeckAgentsDetailParamsSchema,
  DeckAgentsEventStreamsGetParamsSchema,
  DeckAgentsEventStreamsSetParamsSchema,
  DeckAgentsImpactPreviewParamsSchema,
  DeckAgentsModelPolicyGetParamsSchema,
  DeckAgentsModelPolicySetParamsSchema,
  DeckAgentsSkillsGetParamsSchema,
  DeckAgentsSkillsSetParamsSchema,
  DeckAgentsSubagentsGetParamsSchema,
  DeckAgentsSubagentsSetParamsSchema,
  DeckAgentsSystemPromptPreviewParamsSchema,
  DeckAgentsToolPolicyPreviewParamsSchema,
  DeckCommandsDiscoverParamsSchema,
  DeckIdentityLinkParamsSchema,
  DeckIdentityListParamsSchema,
  DeckIdentityUnlinkParamsSchema,
  DeckPluginsListParamsSchema,
  DeckRoutingAddParamsSchema,
  DeckRoutingListParamsSchema,
  DeckRoutingRemoveParamsSchema,
  DeckRoutingSimulateParamsSchema,
  DeckRoutingValidateParamsSchema,
  DeckSubagentsKillParamsSchema,
  DeckSubagentsLineageParamsSchema,
  DeckSubagentsListParamsSchema,
  DeckSubagentsSteerParamsSchema,
  DeckThreadsListParamsSchema,
} from "./schema/deck.js";

const ajv = new (AjvPkg as unknown as new (opts?: object) => import("ajv").default)({
  allErrors: true,
  strict: false,
  removeAdditional: false,
});

export const validateSessionsClearParams =
  ajv.compile<SessionsClearParams>(SessionsClearParamsSchema);
export const validateModelsConfiguredParams = ajv.compile(ModelsConfiguredParamsSchema);
export const validateDeckCommandsDiscoverParams = ajv.compile(DeckCommandsDiscoverParamsSchema);
export const validateDeckRoutingListParams = ajv.compile(DeckRoutingListParamsSchema);
export const validateDeckRoutingAddParams = ajv.compile(DeckRoutingAddParamsSchema);
export const validateDeckRoutingRemoveParams = ajv.compile(DeckRoutingRemoveParamsSchema);
export const validateDeckRoutingValidateParams = ajv.compile(DeckRoutingValidateParamsSchema);
export const validateDeckRoutingSimulateParams = ajv.compile(DeckRoutingSimulateParamsSchema);
export const validateDeckAgentsDetailParams = ajv.compile(DeckAgentsDetailParamsSchema);
export const validateDeckAgentsImpactPreviewParams = ajv.compile(
  DeckAgentsImpactPreviewParamsSchema,
);
export const validateDeckAgentsSkillsGetParams = ajv.compile(DeckAgentsSkillsGetParamsSchema);
export const validateDeckAgentsSkillsSetParams = ajv.compile(DeckAgentsSkillsSetParamsSchema);
export const validateDeckAgentsSubagentsGetParams = ajv.compile(DeckAgentsSubagentsGetParamsSchema);
export const validateDeckAgentsSubagentsSetParams = ajv.compile(DeckAgentsSubagentsSetParamsSchema);
export const validateDeckAgentsModelPolicyGetParams = ajv.compile(
  DeckAgentsModelPolicyGetParamsSchema,
);
export const validateDeckAgentsModelPolicySetParams = ajv.compile(
  DeckAgentsModelPolicySetParamsSchema,
);
export const validateDeckAgentsEventStreamsGetParams = ajv.compile(
  DeckAgentsEventStreamsGetParamsSchema,
);
export const validateDeckAgentsEventStreamsSetParams = ajv.compile(
  DeckAgentsEventStreamsSetParamsSchema,
);
export const validateDeckAgentsToolPolicyPreviewParams = ajv.compile(
  DeckAgentsToolPolicyPreviewParamsSchema,
);
export const validateDeckAgentsSystemPromptPreviewParams = ajv.compile(
  DeckAgentsSystemPromptPreviewParamsSchema,
);
export const validateDeckSubagentsListParams = ajv.compile(DeckSubagentsListParamsSchema);
export const validateDeckSubagentsKillParams = ajv.compile(DeckSubagentsKillParamsSchema);
export const validateDeckSubagentsLineageParams = ajv.compile(DeckSubagentsLineageParamsSchema);
export const validateDeckSubagentsSteerParams = ajv.compile(DeckSubagentsSteerParamsSchema);
export const validateDeckIdentityListParams = ajv.compile(DeckIdentityListParamsSchema);
export const validateDeckIdentityLinkParams = ajv.compile(DeckIdentityLinkParamsSchema);
export const validateDeckIdentityUnlinkParams = ajv.compile(DeckIdentityUnlinkParamsSchema);
export const validateDeckPluginsListParams = ajv.compile(DeckPluginsListParamsSchema);
export const validateDeckThreadsListParams = ajv.compile(DeckThreadsListParamsSchema);

export {
  ModelsConfiguredParamsSchema,
  TranscriptRoleSchema,
  TranscriptTextBlockSchema,
  TranscriptThinkingBlockSchema,
  TranscriptToolUseBlockSchema,
  TranscriptImageBlockSchema,
  TranscriptFileBlockSchema,
  TranscriptBlockSchema,
  TranscriptMessageSchema,
};
export type { SessionsClearParams, TranscriptBlock, TranscriptMessage } from "./schema.js";
