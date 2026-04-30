import type { MethodMetadata } from "../../method-registry.js";
import type { GatewayRequestHandlers } from "../types.js";
import { deckCommandsHandlers, deckCommandsMethodDefs } from "./commands.js";
import { deckIdentityHandlers, deckIdentityMethodDefs } from "./identity.js";
import { deckPluginsHandlers, deckPluginsMethodDefs } from "./plugins.js";
import { deckSubagentsSteerHandlers, deckSubagentsSteerMethodDefs } from "./subagents-steer.js";
import { deckSubagentsHandlers, deckSubagentsMethodDefs } from "./subagents.js";
import { deckThreadsHandlers, deckThreadsMethodDefs } from "./threads.js";

export const deckPreAgentsHandlers: GatewayRequestHandlers = {
  ...deckCommandsHandlers,
};

export const deckPostAgentsHandlers: GatewayRequestHandlers = {
  ...deckSubagentsHandlers,
  ...deckSubagentsSteerHandlers,
  ...deckIdentityHandlers,
  ...deckPluginsHandlers,
  ...deckThreadsHandlers,
};

export const deckPreAgentsMethodDefs: Record<string, MethodMetadata> = {
  ...deckCommandsMethodDefs,
};

export const deckPostAgentsMethodDefs: Record<string, MethodMetadata> = {
  ...deckSubagentsMethodDefs,
  ...deckSubagentsSteerMethodDefs,
  ...deckIdentityMethodDefs,
  ...deckPluginsMethodDefs,
  ...deckThreadsMethodDefs,
};

export const deckHandlers: GatewayRequestHandlers = {
  ...deckPreAgentsHandlers,
  ...deckPostAgentsHandlers,
};

export const deckMethodDefs: Record<string, MethodMetadata> = {
  ...deckPreAgentsMethodDefs,
  ...deckPostAgentsMethodDefs,
};
