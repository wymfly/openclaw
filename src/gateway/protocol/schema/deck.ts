import { Type } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";

const ChatType = Type.Union([
  Type.Literal("direct"),
  Type.Literal("group"),
  Type.Literal("channel"),
]);
const PeerSchema = Type.Object(
  { kind: ChatType, id: NonEmptyString },
  { additionalProperties: false },
);

// === deck.routing.* ===
export const DeckRoutingListParamsSchema = Type.Object(
  {
    agentId: Type.Optional(NonEmptyString),
    channel: Type.Optional(NonEmptyString),
    accountId: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const DeckRoutingAddParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    match: Type.Object(
      {
        channel: NonEmptyString,
        accountId: Type.Optional(Type.String()),
        peer: Type.Optional(PeerSchema),
        guildId: Type.Optional(Type.String()),
        roles: Type.Optional(Type.Array(Type.String())),
        teamId: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    comment: Type.Optional(Type.String()),
    baseHash: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckRoutingRemoveParamsSchema = Type.Object(
  {
    id: NonEmptyString,
    baseHash: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckRoutingValidateParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    match: Type.Object(
      {
        channel: NonEmptyString,
        accountId: Type.Optional(Type.String()),
        peer: Type.Optional(PeerSchema),
        guildId: Type.Optional(Type.String()),
        roles: Type.Optional(Type.Array(Type.String())),
        teamId: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const DeckRoutingSimulateParamsSchema = Type.Object(
  {
    channel: NonEmptyString,
    accountId: Type.Optional(Type.String()),
    peer: Type.Optional(PeerSchema),
    guildId: Type.Optional(Type.String()),
    teamId: Type.Optional(Type.String()),
    memberRoleIds: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

// === deck.agents.* ===
export const DeckAgentsDetailParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckAgentsSkillsGetParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckAgentsSkillsSetParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    mode: Type.Union([Type.Literal("all"), Type.Literal("whitelist")]),
    skills: Type.Array(Type.String()),
    baseHash: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckAgentsSubagentsGetParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckAgentsSubagentsSetParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    allowAgents: Type.Array(Type.String()),
    model: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    baseHash: NonEmptyString,
  },
  { additionalProperties: false },
);

// === deck.subagents.* ===
export const DeckSubagentsListParamsSchema = Type.Object(
  {
    status: Type.Optional(
      Type.Union([
        Type.Literal("active"),
        Type.Literal("completed"),
        Type.Literal("failed"),
        Type.Literal("all"),
      ]),
    ),
    agentId: Type.Optional(NonEmptyString),
    requesterAgentId: Type.Optional(NonEmptyString),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
    offset: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);

export const DeckSubagentsKillParamsSchema = Type.Object(
  {
    runId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckSubagentsLineageParamsSchema = Type.Object(
  {
    runId: Type.Optional(NonEmptyString),
    sessionKey: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

// === deck.identity.* ===
export const DeckIdentityListParamsSchema = Type.Object({}, { additionalProperties: false });

export const DeckIdentityLinkParamsSchema = Type.Object(
  {
    canonical: NonEmptyString,
    channel: NonEmptyString,
    peerId: NonEmptyString,
    baseHash: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckIdentityUnlinkParamsSchema = Type.Object(
  {
    canonical: NonEmptyString,
    channel: NonEmptyString,
    peerId: NonEmptyString,
    baseHash: NonEmptyString,
  },
  { additionalProperties: false },
);

// === deck.threads.* ===
export const DeckThreadsListParamsSchema = Type.Object(
  {
    agentId: Type.Optional(NonEmptyString),
    channel: Type.Optional(NonEmptyString),
    status: Type.Optional(Type.Union([Type.Literal("active"), Type.Literal("all")])),
  },
  { additionalProperties: false },
);
