import { gatewayEventDefs } from "../event-defs.js";
import type { GatewayMethodModule } from "../method-registry.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "events",
  priority: 0,
  handlers: {},
  events: gatewayEventDefs,
};
