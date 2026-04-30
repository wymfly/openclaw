import type { GatewayMethodModule } from "../method-registry.js";
import { sendHandlers } from "./send.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "send",
  priority: 280,
  handlers: sendHandlers,
};
