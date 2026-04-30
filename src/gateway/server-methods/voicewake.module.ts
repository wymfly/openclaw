import type { GatewayMethodModule } from "../method-registry.js";
import { voicewakeHandlers } from "./voicewake.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "voicewake",
  priority: 30,
  handlers: voicewakeHandlers,
};
