import type { GatewayMethodModule } from "../method-registry.js";
import { pushHandlers } from "./push.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "push",
  priority: 270,
  handlers: pushHandlers,
};
