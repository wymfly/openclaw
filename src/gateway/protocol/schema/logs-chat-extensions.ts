import { Type } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";
import { TranscriptMessageSchema } from "./transcript.js";

export const ChatHistoryMessageSchema = TranscriptMessageSchema;

export const ChatHistoryResultSchema = Type.Object(
  {
    sessionKey: NonEmptyString,
    sessionId: NonEmptyString,
    messages: Type.Array(ChatHistoryMessageSchema),
    thinkingLevel: Type.Optional(Type.String()),
    fastMode: Type.Optional(Type.Boolean()),
    verboseLevel: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const ChatSendResultSchema = Type.Object(
  {
    ok: Type.Optional(Type.Boolean()),
    aborted: Type.Optional(Type.Boolean()),
    runIds: Type.Optional(Type.Array(NonEmptyString)),
    runId: Type.Optional(NonEmptyString),
    status: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const ChatAbortResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    aborted: Type.Boolean(),
    runIds: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const ChatEventMessageSchema = TranscriptMessageSchema;

export const ChatEventMediaFields = {
  mediaUrl: Type.Optional(Type.String()),
  mediaUrls: Type.Optional(Type.Array(Type.String())),
  mediaType: Type.Optional(Type.String()),
};
