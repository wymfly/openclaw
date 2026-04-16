import type { MethodMetadata } from "../../method-registry.js";
import type { GatewayRequestHandlers } from "../types.js";
import { deckAgentsPreviewHandlers, deckAgentsPreviewMethodDefs } from "./agents-preview.js";
import { deckAgentsHandlers, deckAgentsMethodDefs } from "./agents.js";
import { deckCommandsHandlers, deckCommandsMethodDefs } from "./commands.js";
import { deckIdentityHandlers, deckIdentityMethodDefs } from "./identity.js";
import { deckPluginsHandlers, deckPluginsMethodDefs } from "./plugins.js";
import { deckRoutingHandlers, deckRoutingMethodDefs } from "./routing.js";
import { deckSubagentsSteerHandlers, deckSubagentsSteerMethodDefs } from "./subagents-steer.js";
import { deckSubagentsHandlers, deckSubagentsMethodDefs } from "./subagents.js";
import { deckThreadsHandlers, deckThreadsMethodDefs } from "./threads.js";

export const deckHandlers: GatewayRequestHandlers = {
  ...deckCommandsHandlers,
  ...deckRoutingHandlers,
  ...deckAgentsHandlers,
  ...deckAgentsPreviewHandlers,
  ...deckSubagentsHandlers,
  ...deckSubagentsSteerHandlers,
  ...deckIdentityHandlers,
  ...deckPluginsHandlers,
  ...deckThreadsHandlers,
};

export const deckMethodDefs: Record<string, MethodMetadata> = {
  ...deckCommandsMethodDefs,
  ...deckRoutingMethodDefs,
  ...deckAgentsMethodDefs,
  ...deckAgentsPreviewMethodDefs,
  ...deckSubagentsMethodDefs,
  ...deckSubagentsSteerMethodDefs,
  ...deckIdentityMethodDefs,
  ...deckPluginsMethodDefs,
  ...deckThreadsMethodDefs,
};
