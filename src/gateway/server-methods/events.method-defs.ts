import { gatewayEventDefs } from "../event-defs.js";
import type { GatewayMethodMetadataModule } from "../method-registry.js";

export const gatewayMethodMetadataModule: GatewayMethodMetadataModule = {
  name: "events",
  priority: 0,
  events: gatewayEventDefs,
};
