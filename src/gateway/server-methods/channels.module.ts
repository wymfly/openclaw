import type { GatewayMethodModule } from "../method-registry.js";
import { channelsHandlers } from "./channels.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "channels",
  priority: 50,
  handlers: channelsHandlers,
};
