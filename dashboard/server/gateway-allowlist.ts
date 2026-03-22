/**
 * Gateway method allowlist — extracted from gateway-adapter.ts for clarity.
 *
 * Methods the Deck server-side may call through the gateway.
 */

export const DEFAULT_METHOD_ALLOWLIST = new Set<string>([
  // --- original studio set ---
  "status",
  "chat.send",
  "chat.abort",
  "chat.history",
  "agents.create",
  "agents.update",
  "agents.delete",
  "agents.list",
  "agents.files.get",
  "agents.files.set",
  "agents.files.list",
  "sessions.list",
  "sessions.preview",
  "sessions.patch",
  "sessions.reset",
  "sessions.delete",
  "cron.list",
  "cron.run",
  "cron.remove",
  "cron.add",
  "cron.update",
  "config.get",
  "config.set",
  "config.patch",
  "config.schema",
  "config.apply",
  "models.list",
  "exec.approval.resolve",
  "exec.approvals.get",
  "exec.approvals.set",
  "agent.wait",
  // --- Deck additions ---
  "health",
  "usage.status",
  "usage.cost",
  "sessions.usage",
  "sessions.usage.timeseries",
  "sessions.usage.logs",
  "channels.status",
  "channels.logout",
  "logs.tail",
  "doctor.memory.status",
  "cron.status",
  "cron.runs",
  "skills.status",
  "skills.update",
  "skills.install",
  // deck.agents
  "deck.agents.detail",
  "deck.agents.skills.get",
  "deck.agents.skills.set",
  "deck.agents.subagents.get",
  "deck.agents.subagents.set",
  // deck.agents preview (P6)
  "deck.agents.toolPolicy.preview",
  "deck.agents.systemPrompt.preview",
  // deck.routing
  "deck.routing.list",
  "deck.routing.add",
  "deck.routing.remove",
  "deck.routing.validate",
  "deck.routing.simulate",
  // deck.auth
  "deck.auth.overview",
  "deck.auth.probe",
  // deck.identity
  "deck.identity.list",
  "deck.identity.link",
  "deck.identity.unlink",
  // deck.threads
  "deck.threads.list",
  // deck.subagents
  "deck.subagents.list",
  "deck.subagents.kill",
  "deck.subagents.lineage",
  "deck.subagents.steer",
]);
