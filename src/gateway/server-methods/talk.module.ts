import type { GatewayMethodModule } from "../method-registry.js";
import { talkHandlers } from "./talk.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "talk",
  priority: 170,
  handlers: talkHandlers,
};
