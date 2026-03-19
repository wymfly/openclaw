import type { GatewayRequestHandlers } from "../types.js";
import { deckAgentsHandlers } from "./agents.js";
import { deckIdentityHandlers } from "./identity.js";
import { deckRoutingHandlers } from "./routing.js";
import { deckSubagentsHandlers } from "./subagents.js";
import { deckThreadsHandlers } from "./threads.js";

export const deckHandlers: GatewayRequestHandlers = {
  ...deckRoutingHandlers,
  ...deckAgentsHandlers,
  ...deckSubagentsHandlers,
  ...deckIdentityHandlers,
  ...deckThreadsHandlers,
};
