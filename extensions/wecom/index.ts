/**
 * Author: YanHaidao
 */
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/wecom";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk/wecom";
import { registerWecomApprovalTools } from "./src/capability/approval/tool.js";
import { registerWecomCalendarTools } from "./src/capability/calendar/tool.js";
import { registerWecomContactTools } from "./src/capability/contact/tool.js";
import { registerWecomDocTools } from "./src/capability/doc/tool.js";
import { registerWecomExternalContactTools } from "./src/capability/external-contact/tool.js";
import { createWeComMcpToolFactory } from "./src/capability/mcp/tool.js";
import { registerWecomMeetingTools } from "./src/capability/meeting/tool.js";
import { registerWecomTodoTools } from "./src/capability/todo/tool.js";
import { wecomPlugin } from "./src/channel.js";
import { handleWecomWebhookRequest } from "./src/monitor.js";
import { setWecomRuntime } from "./src/runtime.js";

const plugin = {
  id: "wecom",
  name: "WeCom (企业微信)",
  description: "企业微信官方推荐三方插件，默认 Bot WS，支持主动发消息与统一运行时能力",
  configSchema: emptyPluginConfigSchema(),
  /**
   * **register (注册插件)**
   *
   * OpenClaw 插件入口点。
   * 1. 注入统一 runtime compatibility layer。
   * 2. 注册 capability-first WeCom 渠道插件。
   * 3. 注册统一 HTTP 入口（所有 webhook 请求都走共享路由器）。
   */
  register(api: OpenClawPluginApi) {
    setWecomRuntime(api.runtime);
    api.registerChannel({ plugin: wecomPlugin });
    const routes = ["/plugins/wecom", "/wecom"];
    for (const path of routes) {
      api.registerHttpRoute({
        path,
        handler: handleWecomWebhookRequest,
        auth: "plugin",
        match: "prefix",
      });
    }

    // Register WeCom Doc Tools
    registerWecomDocTools(api);
    registerWecomCalendarTools(api);
    if (typeof api.registerTool === "function") {
      api.registerTool(createWeComMcpToolFactory());
    }

    // P1 — Contact (self-developed)
    registerWecomContactTools(api);
    registerWecomMeetingTools(api);
    registerWecomTodoTools(api);
    // P2 — Approval (self-developed)
    registerWecomApprovalTools(api);
    registerWecomExternalContactTools(api);
  },
};

export default plugin;
