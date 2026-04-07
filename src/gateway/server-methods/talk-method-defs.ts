import type { MethodMetadata } from "../method-registry.js";
import { READ_SCOPE, WRITE_SCOPE } from "../method-scopes.js";
import {
  TalkConfigParamsSchema,
  TalkConfigResultSchema,
  TalkModeParamsSchema,
  TalkModeResultSchema,
  TalkSpeakParamsSchema,
  TalkSpeakResultSchema,
} from "../protocol/schema/channels.js";

export const talkMethodDefs: Record<string, MethodMetadata> = {
  "talk.config": {
    params: TalkConfigParamsSchema,
    result: TalkConfigResultSchema,
    scope: READ_SCOPE,
  },
  "talk.speak": {
    params: TalkSpeakParamsSchema,
    result: TalkSpeakResultSchema,
    scope: WRITE_SCOPE,
  },
  "talk.mode": {
    params: TalkModeParamsSchema,
    result: TalkModeResultSchema,
    scope: WRITE_SCOPE,
  },
};
