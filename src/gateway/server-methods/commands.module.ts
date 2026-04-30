import type { GatewayMethodModule } from "../method-registry.js";
import { commandsHandlers } from "./commands.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "commands",
  priority: 70,
  handlers: commandsHandlers,
};
