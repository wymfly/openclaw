import type { GatewayMethodModule } from "../method-registry.js";
import { webHandlers } from "./web.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "web",
  priority: 120,
  handlers: webHandlers,
};
