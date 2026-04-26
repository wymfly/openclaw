import type { ReactNode } from "react";
import { ActivityPanel } from "../components/panels/activity/ActivityPanel";
import { AgentsPanel } from "../components/panels/agents/AgentsPanel";
import { AlertsPanel } from "../components/panels/alerts/AlertsPanel";
import { ApiExplorerPanel } from "../components/panels/api-explorer/ApiExplorerPanel";
import { ApprovalsPanel } from "../components/panels/approvals/ApprovalsPanel";
import { BudgetPanel } from "../components/panels/budget/BudgetPanel";
import { ChannelsPanel } from "../components/panels/channels/ChannelsPanel";
import { ConfigPanel } from "../components/panels/config/ConfigPanel";
import { CronPanel } from "../components/panels/cron/CronPanel";
import { DocsPanel } from "../components/panels/docs/DocsPanel";
import { GatewayPanel } from "../components/panels/gateway/GatewayPanel";
import { IdentityPanel } from "../components/panels/identity/IdentityPanel";
import { LogsPanel } from "../components/panels/logs/LogsPanel";
import { MemoryPanel } from "../components/panels/memory/MemoryPanel";
import { ModelsPanel } from "../components/panels/models/ModelsPanel";
import { NodesPanel } from "../components/panels/nodes/NodesPanel";
import { PluginsPanel } from "../components/panels/plugins/PluginsPanel";
import { RoutingPanel } from "../components/panels/routing/RoutingPanel";
import { SessionsPanel } from "../components/panels/sessions/SessionsPanel";
import { SettingsPanel } from "../components/panels/settings/SettingsPanel";
import { SkillsPanel } from "../components/panels/skills/SkillsPanel";
import { SubagentsPanel } from "../components/panels/subagents/SubagentsPanel";
import { ThreadsPanel } from "../components/panels/threads/ThreadsPanel";
import { UsagePanel } from "../components/panels/usage/UsagePanel";
import { WebhooksPanel } from "../components/panels/webhooks/WebhooksPanel";
import type { PanelId } from "./panel-registry";

export function renderPanelComponent(id: PanelId): ReactNode | null {
  switch (id) {
    case "agents":
      return <AgentsPanel />;
    case "gateway":
      return <GatewayPanel />;
    case "models":
      return <ModelsPanel />;
    case "logs":
      return <LogsPanel />;
    case "activity":
      return <ActivityPanel />;
    case "sessions":
      return <SessionsPanel />;
    case "settings":
      return <SettingsPanel />;
    case "plugins":
      return <PluginsPanel />;
    case "channels":
      return <ChannelsPanel />;
    case "api-explorer":
      return <ApiExplorerPanel />;
    case "approvals":
      return <ApprovalsPanel />;
    case "skills":
      return <SkillsPanel />;
    case "config":
      return <ConfigPanel />;
    case "cron":
      return <CronPanel />;
    case "docs":
      return <DocsPanel />;
    case "alerts":
      return <AlertsPanel />;
    case "budget":
      return <BudgetPanel />;
    case "webhooks":
      return <WebhooksPanel />;
    case "nodes":
      return <NodesPanel />;
    case "memory":
      return <MemoryPanel />;
    case "identity":
      return <IdentityPanel />;
    case "threads":
      return <ThreadsPanel />;
    case "usage":
      return <UsagePanel />;
    case "routing":
      return <RoutingPanel />;
    case "subagents":
      return <SubagentsPanel />;
    default:
      return null;
  }
}
