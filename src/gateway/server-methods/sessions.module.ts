import type { GatewayMethodModule } from "../method-registry.js";
import { sessionsMethodDefs } from "./sessions-method-defs.js";
import { sessionsHandlers } from "./sessions.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "sessions",
  priority: 220,
  handlers: sessionsHandlers,
  methodDefs: sessionsMethodDefs,
};
