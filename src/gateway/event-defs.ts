import type { EventDefinition } from "./method-registry.js";
import { AgentEventSchema } from "./protocol/schema/agent.js";
import { ChatEventSchema } from "./protocol/schema/logs-chat.js";
import {
  SessionMessageEventPayloadSchema,
  SessionsChangedEventPayloadSchema,
  SessionToolEventPayloadSchema,
} from "./protocol/schema/transcript.js";

export const gatewayEventDefs: Record<string, EventDefinition> = {
  chat: {
    payload: ChatEventSchema,
  },
  agent: {
    payload: AgentEventSchema,
  },
  "session.message": {
    payload: SessionMessageEventPayloadSchema,
  },
  "session.tool": {
    payload: SessionToolEventPayloadSchema,
  },
  "sessions.changed": {
    payload: SessionsChangedEventPayloadSchema,
  },
};
