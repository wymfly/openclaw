// extensions/wecom/src/capability/approval/tool.ts

import type { OpenClawPluginApi } from "openclaw/plugin-sdk/wecom";
import { resolveAgentAccountOrUndefined } from "../bot/fallback-delivery.js";
import { buildToolError, buildToolResult, type WecomToolContext } from "../shared-tool-types.js";
import { WecomApprovalClient } from "./client.js";
import { wecomApprovalToolSchema } from "./schema.js";

export function registerWecomApprovalTools(api: OpenClawPluginApi) {
  if (typeof api?.registerTool !== "function") return;
  const approvalClient = new WecomApprovalClient();

  api.registerTool((toolContext: WecomToolContext) => ({
    name: "wecom_approval",
    label: "WeCom Approval",
    description: "企业微信审批工具，支持提交审批、查询审批列表、获取审批详情和审批模板。",
    parameters: wecomApprovalToolSchema,
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      try {
        const accountId = (params.accountId as string) || toolContext?.accountId || "default";
        const account = resolveAgentAccountOrUndefined(api.config, accountId);
        if (!account || !account.configured) {
          throw new Error(
            `WeCom account ${accountId} not configured for Approval API requirements`,
          );
        }

        const action = params.action;
        switch (action) {
          case "submit": {
            const result = await approvalClient.submit(account, {
              creator_userid: params.creator_userid as string,
              template_id: params.template_id as string,
              use_template_approver: params.use_template_approver as number | undefined,
              approver: params.approver as Array<{ attr: number; userid: string[] }> | undefined,
              apply_data: params.apply_data as
                | { contents: Array<Record<string, unknown>> }
                | undefined,
              summary_list: params.summary_list as
                | Array<{ summary_info: Array<{ text: string; lang: string }> }>
                | undefined,
            });
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `审批已提交：${result.sp_no}`,
              sp_no: result.sp_no,
            });
          }
          case "list": {
            const result = await approvalClient.list(account, {
              start_time: params.start_time as string,
              end_time: params.end_time as string,
              template_id: params.template_id as string | undefined,
              cursor: params.cursor as number | undefined,
              size: params.size as number | undefined,
            });
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `找到 ${result.sp_no_list.length} 条审批记录`,
              sp_no_list: result.sp_no_list,
              next_cursor: result.next_cursor,
            });
          }
          case "get_detail": {
            const record = await approvalClient.getDetail(account, params.sp_no as string);
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `审批详情已获取：${record.sp_name || params.sp_no}`,
              record,
            });
          }
          case "get_template": {
            const template = await approvalClient.getTemplate(
              account,
              params.template_id as string,
            );
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `审批模板已获取`,
              template,
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
