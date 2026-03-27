// Side-effect-free export for codegen consumption.
// MUST NOT import modules with side-effects at module scope.
//
// Verify: bun -e 'import("./src/gateway/method-registry-data.ts")'
import type { MethodMetadata } from "./method-registry.js";
import { PROTOCOL_VERSION } from "./protocol/schema/protocol-schemas.js";
import { deckAuthMethodDefs } from "./server-methods/deck-auth.js";
import { deckMethodDefs } from "./server-methods/deck/index.js";

export { PROTOCOL_VERSION };

// ---------------------------------------------------------------------------
// All P0 methodDefs (deck.* + deck.auth.*) — real schemas from gateway-dev.
// ---------------------------------------------------------------------------

export const allMethodDefs: Record<string, MethodMetadata> = {
  ...deckMethodDefs,
  ...deckAuthMethodDefs,
};

// ---------------------------------------------------------------------------
// All known method names — used for allowlist generation.
//
// This list mirrors BASE_METHODS from server-methods-list.ts but is maintained
// here independently to avoid importing modules with runtime side-effects
// (server-methods-list.ts → channels/plugins → plugins/runtime).
//
// When methods are added/removed in server-methods-list.ts, update this list
// and rerun `pnpm protocol:gen:ts`.
// ---------------------------------------------------------------------------

export const allMethodNames: readonly string[] = [
  "health",
  "doctor.memory.status",
  "logs.tail",
  "channels.status",
  "channels.logout",
  "status",
  "usage.status",
  "usage.cost",
  "tts.status",
  "tts.providers",
  "tts.enable",
  "tts.disable",
  "tts.convert",
  "tts.setProvider",
  "config.get",
  "config.set",
  "config.apply",
  "config.patch",
  "config.schema",
  "config.schema.lookup",
  "exec.approvals.get",
  "exec.approvals.set",
  "exec.approvals.node.get",
  "exec.approvals.node.set",
  "exec.approval.request",
  "exec.approval.waitDecision",
  "exec.approval.resolve",
  "wizard.start",
  "wizard.next",
  "wizard.cancel",
  "wizard.status",
  "talk.config",
  "talk.speak",
  "talk.mode",
  "models.list",
  "models.configured",
  "models.catalog.providers",
  "tools.catalog",
  "agents.list",
  "agents.create",
  "agents.update",
  "agents.delete",
  "agents.files.list",
  "agents.files.get",
  "agents.files.set",
  "skills.status",
  "skills.bins",
  "skills.install",
  "skills.update",
  "update.run",
  "voicewake.get",
  "voicewake.set",
  "secrets.reload",
  "secrets.resolve",
  "sessions.list",
  "sessions.subscribe",
  "sessions.unsubscribe",
  "sessions.messages.subscribe",
  "sessions.messages.unsubscribe",
  "sessions.preview",
  "sessions.create",
  "sessions.send",
  "sessions.abort",
  "sessions.patch",
  "sessions.reset",
  "sessions.delete",
  "sessions.compact",
  "last-heartbeat",
  "set-heartbeats",
  "wake",
  "node.pair.request",
  "node.pair.list",
  "node.pair.approve",
  "node.pair.reject",
  "node.pair.verify",
  "device.pair.list",
  "device.pair.approve",
  "device.pair.reject",
  "device.pair.remove",
  "device.token.rotate",
  "device.token.revoke",
  "node.rename",
  "node.list",
  "node.describe",
  "node.pending.drain",
  "node.pending.enqueue",
  "node.invoke",
  "node.pending.pull",
  "node.pending.ack",
  "node.invoke.result",
  "node.event",
  "node.canvas.capability.refresh",
  "cron.list",
  "cron.status",
  "cron.add",
  "cron.update",
  "cron.remove",
  "cron.run",
  "cron.runs",
  "gateway.identity.get",
  "system-presence",
  "system-event",
  "send",
  "agent",
  "agent.identity.get",
  "agent.wait",
  "browser.request",
  "chat.history",
  "chat.abort",
  "chat.send",
  // deck.auth
  "deck.auth.overview",
  "deck.auth.probe",
  // deck.routing
  "deck.routing.list",
  "deck.routing.add",
  "deck.routing.remove",
  "deck.routing.validate",
  "deck.routing.simulate",
  // deck.agents
  "deck.agents.detail",
  "deck.agents.skills.get",
  "deck.agents.skills.set",
  "deck.agents.subagents.get",
  "deck.agents.subagents.set",
  "deck.agents.toolPolicy.preview",
  "deck.agents.systemPrompt.preview",
  "deck.agents.eventStreams.get",
  "deck.agents.eventStreams.set",
  // deck.subagents
  "deck.subagents.list",
  "deck.subagents.kill",
  "deck.subagents.lineage",
  "deck.subagents.steer",
  // deck.identity
  "deck.identity.list",
  "deck.identity.link",
  "deck.identity.unlink",
  // deck.threads
  "deck.threads.list",
  // gateway introspection
  "gateway.describe",
];

// All known event names
export const allEventNames: readonly string[] = [
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
  "update.available",
];
