import type { OpenClawConfig, PluginRuntime } from "openclaw/plugin-sdk";
import type { UnifiedInboundEvent } from "../types/index.js";

export function resolveRuntimeRoute(params: {
  core: PluginRuntime;
  cfg: OpenClawConfig;
  event: UnifiedInboundEvent;
}) {
  return params.core.channel.routing.resolveAgentRoute({
    cfg: params.cfg,
    channel: "wecom",
    accountId: params.event.accountId,
    peer: {
      kind: params.event.conversation.peerKind,
      id: params.event.conversation.peerId,
    },
  });
}
