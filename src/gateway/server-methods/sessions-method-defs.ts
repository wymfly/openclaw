import type { MethodMetadata } from "../method-registry.js";
import { ADMIN_SCOPE, READ_SCOPE, WRITE_SCOPE } from "../method-scopes.js";
import {
  SessionsAbortParamsSchema,
  SessionsAbortResultSchema,
  SessionsClearParamsSchema,
  SessionsClearResultSchema,
  SessionsCompactParamsSchema,
  SessionsCompactResultSchema,
  SessionsCreateParamsSchema,
  SessionsCreateResultSchema,
  SessionsDeleteParamsSchema,
  SessionsDeleteResultSchema,
  SessionsListParamsSchema,
  SessionsListResultSchema,
  SessionsMessagesSubscribeParamsSchema,
  SessionsMessagesSubscriptionResultSchema,
  SessionsMessagesUnsubscribeParamsSchema,
  SessionsPatchParamsSchema,
  SessionsPatchResultSchema,
  SessionsPreviewParamsSchema,
  SessionsPreviewResultSchema,
  SessionsResetParamsSchema,
  SessionsResetResultSchema,
  SessionsSendParamsSchema,
  SessionsSendResultSchema,
  SessionsSubscribeResultSchema,
} from "../protocol/schema/sessions.js";

export const sessionsMethodDefs: Record<string, MethodMetadata> = {
  "sessions.list": {
    params: SessionsListParamsSchema,
    result: SessionsListResultSchema,
    scope: READ_SCOPE,
  },
  "sessions.subscribe": {
    result: SessionsSubscribeResultSchema,
    scope: READ_SCOPE,
  },
  "sessions.unsubscribe": {
    result: SessionsSubscribeResultSchema,
    scope: READ_SCOPE,
  },
  "sessions.messages.subscribe": {
    params: SessionsMessagesSubscribeParamsSchema,
    result: SessionsMessagesSubscriptionResultSchema,
    scope: READ_SCOPE,
  },
  "sessions.messages.unsubscribe": {
    params: SessionsMessagesUnsubscribeParamsSchema,
    result: SessionsMessagesSubscriptionResultSchema,
    scope: READ_SCOPE,
  },
  "sessions.preview": {
    params: SessionsPreviewParamsSchema,
    result: SessionsPreviewResultSchema,
    scope: READ_SCOPE,
  },
  "sessions.create": {
    params: SessionsCreateParamsSchema,
    result: SessionsCreateResultSchema,
    scope: WRITE_SCOPE,
  },
  "sessions.send": {
    params: SessionsSendParamsSchema,
    result: SessionsSendResultSchema,
    scope: WRITE_SCOPE,
  },
  "sessions.steer": {
    params: SessionsSendParamsSchema,
    result: SessionsSendResultSchema,
    scope: WRITE_SCOPE,
  },
  "sessions.abort": {
    params: SessionsAbortParamsSchema,
    result: SessionsAbortResultSchema,
    scope: WRITE_SCOPE,
  },
  "sessions.patch": {
    params: SessionsPatchParamsSchema,
    result: SessionsPatchResultSchema,
    scope: ADMIN_SCOPE,
  },
  "sessions.reset": {
    params: SessionsResetParamsSchema,
    result: SessionsResetResultSchema,
    scope: ADMIN_SCOPE,
  },
  "sessions.clear": {
    params: SessionsClearParamsSchema,
    result: SessionsClearResultSchema,
    scope: ADMIN_SCOPE,
  },
  "sessions.delete": {
    params: SessionsDeleteParamsSchema,
    result: SessionsDeleteResultSchema,
    scope: ADMIN_SCOPE,
  },
  "sessions.compact": {
    params: SessionsCompactParamsSchema,
    result: SessionsCompactResultSchema,
    scope: ADMIN_SCOPE,
  },
};
