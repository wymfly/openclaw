import type { GatewayMethodModule } from "../method-registry.js";
import { ttsHandlers } from "./tts.js";

export const gatewayMethodModule: GatewayMethodModule = {
  name: "tts",
  priority: 200,
  handlers: ttsHandlers,
};
