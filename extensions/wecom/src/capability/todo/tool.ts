import type { OpenClawPluginApi } from "openclaw/plugin-sdk/wecom";
import { resolveAgentAccountOrUndefined } from "../bot/fallback-delivery.js";
import { buildToolError, buildToolResult, type WecomToolContext } from "../shared-tool-types.js";
import { WecomTodoClient } from "./client.js";
import { wecomTodoToolSchema } from "./schema.js";

export function registerWecomTodoTools(api: OpenClawPluginApi) {
  if (typeof api?.registerTool !== "function") return;
  const todoClient = new WecomTodoClient();

  api.registerTool((toolContext: WecomToolContext) => ({
    name: "wecom_todo",
    label: "WeCom Todo",
    description: "企业微信待办工具，支持创建待办、更新状态和查询详情。",
    parameters: wecomTodoToolSchema,
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      try {
        const accountId = (params.accountId as string) || toolContext?.accountId || "default";
        const account = resolveAgentAccountOrUndefined(api.config, accountId);
        if (!account || !account.configured) {
          throw new Error(`WeCom account ${accountId} not configured for Todo API requirements`);
        }

        const action = params.action;
        switch (action) {
          case "create": {
            const spNo = await todoClient.create(account, {
              title: params.title as string,
              creator: params.creator as string,
              url: params.url as string | undefined,
              appname: params.appname as string | undefined,
              userids: params.userids as string[] | undefined,
            });
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `待办已创建：${params.title}`,
              sp_no: spNo,
            });
          }
          case "update_status": {
            const status = Number(params.status);
            await todoClient.updateStatus(account, params.sp_no as string, status);
            const statusLabel = status === 1 ? "已完成" : "未完成";
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `待办状态已更新：${statusLabel}`,
              sp_no: params.sp_no,
              status,
              statusLabel,
            });
          }
          case "get": {
            const workRecord = await todoClient.get(account, params.sp_no as string);
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `待办详情已获取：${workRecord.title || params.sp_no}`,
              workRecord,
            });
          }
          default:
            throw new Error(`Unsupported action: ${String(action)}`);
        }
      } catch (err) {
        return buildToolError(params?.action as string | undefined, err);
      }
    },
  }));
}
