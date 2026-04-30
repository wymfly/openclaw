import type { GatewayMethodModule } from "../method-registry.js";
import { cronHandlers } from "./cron.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "cron",
  priority: 80,
  handlers: cronHandlers,
};
