import { Type, type Static } from "@sinclair/typebox";
import { DeliveryContextSchema } from "./sessions.js";

export const TranscriptRoleSchema = Type.Union([
  Type.Literal("user"),
  Type.Literal("assistant"),
  Type.Literal("system"),
]);

export const TranscriptTextBlockSchema = Type.Object(
  {
    type: Type.Literal("text"),
    text: Type.String(),
  },
  { additionalProperties: false },
);

export const TranscriptThinkingBlockSchema = Type.Object(
  {
    type: Type.Literal("thinking"),
    text: Type.String(),
  },
  { additionalProperties: false },
);

export const TranscriptToolUseBlockSchema = Type.Object(
  {
    type: Type.Literal("tool_use"),
    id: Type.String(),
    name: Type.String(),
    input: Type.Record(Type.String(), Type.Unknown()),
  },
  { additionalProperties: false },
);

export const TranscriptImageBlockSchema = Type.Object(
  {
    type: Type.Literal("image"),
    data: Type.String(),
    mimeType: Type.String(),
    fileName: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const TranscriptFileBlockSchema = Type.Object(
  {
    type: Type.Literal("file"),
    data: Type.String(),
    mimeType: Type.String(),
    fileName: Type.String(),
    size: Type.Optional(Type.Number({ minimum: 0 })),
  },
  { additionalProperties: false },
);

export const TranscriptCanvasBlockSchema = Type.Object(
  {
    type: Type.Literal("canvas"),
    kind: Type.Literal("canvas"),
    surface: Type.Literal("assistant_message"),
    render: Type.Literal("url"),
    url: Type.String(),
    viewId: Type.Optional(Type.String()),
    title: Type.Optional(Type.String()),
    preferredHeight: Type.Optional(Type.Number({ minimum: 0 })),
  },
  { additionalProperties: false },
);

export const TranscriptUnknownBlockSchema = Type.Object(
  {
    type: Type.Literal("unknown"),
    rawType: Type.String(),
    summary: Type.Record(Type.String(), Type.Unknown()),
  },
  { additionalProperties: false },
);

export const TranscriptBlockSchema = Type.Recursive(
  (Self) =>
    Type.Union([
      TranscriptTextBlockSchema,
      TranscriptThinkingBlockSchema,
      TranscriptToolUseBlockSchema,
      Type.Object(
        {
          type: Type.Literal("tool_result"),
          toolUseId: Type.String(),
          content: Type.Union([Type.String(), Type.Array(Self)]),
          isError: Type.Optional(Type.Boolean()),
        },
        { additionalProperties: false },
      ),
      TranscriptImageBlockSchema,
      TranscriptFileBlockSchema,
      TranscriptCanvasBlockSchema,
      TranscriptUnknownBlockSchema,
    ]),
  { $id: "TranscriptBlock" },
);

export const TranscriptMessageSchema = Type.Object(
  {
    id: Type.Optional(Type.String()),
    role: TranscriptRoleSchema,
    content: Type.Array(TranscriptBlockSchema),
    timestamp: Type.Number(),
  },
  { additionalProperties: true },
);

export const SessionSnapshotFieldsSchema = Type.Object(
  {
    updatedAt: Type.Optional(Type.Number()),
    sessionId: Type.Optional(Type.String()),
    kind: Type.Optional(
      Type.Union([
        Type.Literal("direct"),
        Type.Literal("group"),
        Type.Literal("global"),
        Type.Literal("unknown"),
      ]),
    ),
    channel: Type.Optional(Type.String()),
    label: Type.Optional(Type.String()),
    displayName: Type.Optional(Type.String()),
    deliveryContext: Type.Optional(DeliveryContextSchema),
    parentSessionKey: Type.Optional(Type.String()),
    childSessions: Type.Optional(Type.Array(Type.String())),
    thinkingLevel: Type.Optional(Type.String()),
    fastMode: Type.Optional(Type.Boolean()),
    verboseLevel: Type.Optional(Type.String()),
    systemSent: Type.Optional(Type.Boolean()),
    abortedLastRun: Type.Optional(Type.Boolean()),
    lastChannel: Type.Optional(Type.String()),
    lastTo: Type.Optional(Type.String()),
    lastAccountId: Type.Optional(Type.String()),
    totalTokens: Type.Optional(Type.Number()),
    totalTokensFresh: Type.Optional(Type.Boolean()),
    contextTokens: Type.Optional(Type.Number()),
    estimatedCostUsd: Type.Optional(Type.Number()),
    modelProvider: Type.Optional(Type.String()),
    model: Type.Optional(Type.String()),
    status: Type.Optional(
      Type.Union([
        Type.Literal("running"),
        Type.Literal("done"),
        Type.Literal("failed"),
        Type.Literal("killed"),
        Type.Literal("timeout"),
      ]),
    ),
    startedAt: Type.Optional(Type.Number()),
    endedAt: Type.Optional(Type.Number()),
    runtimeMs: Type.Optional(Type.Number()),
  },
  { additionalProperties: false },
);

const SessionToolResultValueSchema = Type.Union([
  Type.String(),
  Type.Array(TranscriptBlockSchema),
  Type.Object(
    {
      content: Type.Optional(Type.Union([Type.String(), Type.Array(TranscriptBlockSchema)])),
      details: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    },
    { additionalProperties: true },
  ),
]);

export const SessionMessageEventPayloadSchema = Type.Composite(
  [
    Type.Object(
      {
        sessionKey: Type.String(),
        message: TranscriptMessageSchema,
        messageId: Type.Optional(Type.String()),
        messageSeq: Type.Optional(Type.Integer({ minimum: 0 })),
      },
      { additionalProperties: false },
    ),
    SessionSnapshotFieldsSchema,
  ],
  { additionalProperties: false },
);

export const SessionToolEventDataSchema = Type.Object(
  {
    phase: Type.String(),
    name: Type.Optional(Type.String()),
    toolCallId: Type.Optional(Type.String()),
    args: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    result: Type.Optional(SessionToolResultValueSchema),
    partialResult: Type.Optional(SessionToolResultValueSchema),
    isError: Type.Optional(Type.Boolean()),
    error: Type.Optional(Type.String()),
  },
  { additionalProperties: true },
);

export const SessionToolEventPayloadSchema = Type.Object(
  {
    runId: Type.String(),
    seq: Type.Integer({ minimum: 0 }),
    stream: Type.Literal("tool"),
    ts: Type.Integer({ minimum: 0 }),
    sessionKey: Type.String(),
    data: SessionToolEventDataSchema,
  },
  { additionalProperties: false },
);

export const SessionsChangedEventPayloadSchema = Type.Composite(
  [
    Type.Object(
      {
        sessionKey: Type.String(),
        phase: Type.Optional(Type.String()),
        ts: Type.Number(),
        runId: Type.Optional(Type.String()),
        messageId: Type.Optional(Type.String()),
        messageSeq: Type.Optional(Type.Integer({ minimum: 0 })),
        reason: Type.Optional(Type.String()),
        parentSessionKey: Type.Optional(Type.String()),
        label: Type.Optional(Type.String()),
        displayName: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    SessionSnapshotFieldsSchema,
  ],
  { additionalProperties: false },
);

export type TranscriptBlock = Static<typeof TranscriptBlockSchema>;
export type TranscriptMessage = Static<typeof TranscriptMessageSchema>;
