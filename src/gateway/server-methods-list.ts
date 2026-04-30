import { listChannelPlugins } from "../channels/plugins/index.js";
import { GATEWAY_EVENT_UPDATE_AVAILABLE } from "./events.js";
import { gatewayMethodRegistry } from "./server-methods.js";

const GATEWAY_AUX_METHODS = [
  "exec.approval.get",
  "exec.approval.list",
  "exec.approval.request",
  "exec.approval.waitDecision",
  "exec.approval.resolve",
  "plugin.approval.list",
  "plugin.approval.request",
  "plugin.approval.waitDecision",
  "plugin.approval.resolve",
  "secrets.reload",
  "secrets.resolve",
] as const;

export function listGatewayMethods(): string[] {
  const channelMethods = listChannelPlugins().flatMap((plugin) => plugin.gatewayMethods ?? []);
  const baseMethods = gatewayMethodRegistry.listMethods().toSorted();
  return Array.from(new Set([...baseMethods, ...GATEWAY_AUX_METHODS, ...channelMethods]));
}

export const GATEWAY_EVENTS = [
  "connect.challenge",
  "agent",
  "chat",
  "session.message",
  "session.tool",
  "sessions.changed",
  "presence",
  "tick",
  "talk.mode",
  "shutdown",
  "health",
  "heartbeat",
  "cron",
  "node.pair.requested",
  "node.pair.resolved",
  "node.invoke.request",
  "device.pair.requested",
  "device.pair.resolved",
  "voicewake.changed",
  "exec.approval.requested",
  "exec.approval.resolved",
  "plugin.approval.requested",
  "plugin.approval.resolved",
  GATEWAY_EVENT_UPDATE_AVAILABLE,
];
