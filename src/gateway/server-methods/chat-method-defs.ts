import type { MethodMetadata } from "../method-registry.js";
import { READ_SCOPE, WRITE_SCOPE } from "../method-scopes.js";
import {
  ChatAbortParamsSchema,
  ChatAbortResultSchema,
  ChatHistoryParamsSchema,
  ChatHistoryResultSchema,
  ChatSendParamsSchema,
  ChatSendResultSchema,
} from "../protocol/schema/logs-chat.js";

export const chatMethodDefs: Record<string, MethodMetadata> = {
  "chat.history": {
    params: ChatHistoryParamsSchema,
    result: ChatHistoryResultSchema,
    scope: READ_SCOPE,
  },
  "chat.abort": {
    params: ChatAbortParamsSchema,
    result: ChatAbortResultSchema,
    scope: WRITE_SCOPE,
  },
  "chat.send": {
    params: ChatSendParamsSchema,
    result: ChatSendResultSchema,
    scope: WRITE_SCOPE,
  },
};
