// extensions/wecom/src/capability/approval/tool.ts

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { resolveAgentAccountOrUndefined } from "../bot/fallback-delivery.js";
import { WecomApprovalClient } from "./client.js";
import { wecomApprovalToolSchema } from "./schema.js";

function buildToolResult(payload: any) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

export function registerWecomApprovalTools(api: OpenClawPluginApi) {
  if (typeof api?.registerTool !== "function") return;
  const approvalClient = new WecomApprovalClient();

  api.registerTool((toolContext: any) => ({
    name: "wecom_approval",
    label: "WeCom Approval",
    description: "企业微信审批工具，支持提交审批、查询审批列表、获取审批详情和审批模板。",
    parameters: wecomApprovalToolSchema,
    async execute(_toolCallId, params: any) {
      try {
        const accountId = params.accountId || toolContext?.accountId || "default";
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
              creator_userid: params.creator_userid,
              template_id: params.template_id,
              use_template_approver: params.use_template_approver,
              approver: params.approver,
              apply_data: params.apply_data,
              summary_list: params.summary_list,
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
              start_time: params.start_time,
              end_time: params.end_time,
              template_id: params.template_id,
              cursor: params.cursor,
              size: params.size,
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
            const record = await approvalClient.getDetail(account, params.sp_no);
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `审批详情已获取：${record.sp_name || params.sp_no}`,
              record,
            });
          }
          case "get_template": {
            const template = await approvalClient.getTemplate(account, params.template_id);
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
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  ok: false,
                  action: params?.action,
                  error: err instanceof Error ? err.message : String(err),
                },
                null,
                2,
              ),
            },
          ],
          details: {},
          isError: true,
        };
      }
    },
  }));
}
