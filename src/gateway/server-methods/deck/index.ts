import type { GatewayRequestHandlers } from "../types.js";
import { deckAgentsPreviewHandlers } from "./agents-preview.js";
import { deckAgentsHandlers } from "./agents.js";
import { deckIdentityHandlers } from "./identity.js";
import { deckRoutingHandlers } from "./routing.js";
import { deckSubagentsSteerHandlers } from "./subagents-steer.js";
import { deckSubagentsHandlers } from "./subagents.js";
import { deckThreadsHandlers } from "./threads.js";

export const deckHandlers: GatewayRequestHandlers = {
  ...deckRoutingHandlers,
  ...deckAgentsHandlers,
  ...deckAgentsPreviewHandlers,
  ...deckSubagentsHandlers,
  ...deckSubagentsSteerHandlers,
  ...deckIdentityHandlers,
  ...deckThreadsHandlers,
};
