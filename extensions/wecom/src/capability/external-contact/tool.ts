// extensions/wecom/src/capability/external-contact/tool.ts

import type { OpenClawPluginApi } from "openclaw/plugin-sdk/wecom";
import { resolveAgentAccountOrUndefined } from "../bot/fallback-delivery.js";
import { buildToolError, buildToolResult, type WecomToolContext } from "../shared-tool-types.js";
import { WecomExternalContactClient } from "./client.js";
import { wecomExternalContactToolSchema } from "./schema.js";

export function registerWecomExternalContactTools(api: OpenClawPluginApi) {
  if (typeof api?.registerTool !== "function") return;
  const externalContactClient = new WecomExternalContactClient();

  api.registerTool((toolContext: WecomToolContext) => ({
    name: "wecom_external_contact",
    label: "WeCom External Contact",
    description: "企业微信客户联系工具，支持获取外部联系人详情、列表和客户群列表。",
    parameters: wecomExternalContactToolSchema,
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      try {
        const accountId = (params.accountId as string) || toolContext?.accountId || "default";
        const account = resolveAgentAccountOrUndefined(api.config, accountId);
        if (!account || !account.configured) {
          throw new Error(
            `WeCom account ${accountId} not configured for External Contact API requirements`,
          );
        }

        const action = params.action;
        switch (action) {
          case "get": {
            const detail = await externalContactClient.get(
              account,
              params.external_userid as string,
            );
            const contactName = detail.external_contact?.name || params.external_userid;
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `外部联系人详情已获取：${contactName}`,
              detail,
            });
          }
          case "list": {
            const externalUserids = await externalContactClient.list(
              account,
              params.userid as string,
            );
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `找到 ${externalUserids.length} 个外部联系人`,
              userid: params.userid,
              external_userid_list: externalUserids,
            });
          }
          case "list_groups": {
            const result = await externalContactClient.listGroups(account, {
              status_filter: params.status_filter as number | undefined,
              owner_filter: params.owner_filter as { userid_list?: string[] } | undefined,
              cursor: params.cursor as string | undefined,
              limit: params.limit as number | undefined,
            });
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `找到 ${result.group_chat_list.length} 个客户群`,
              group_chat_list: result.group_chat_list,
              next_cursor: result.next_cursor,
            });
          }
          case "get_group_detail": {
            const groupChat = await externalContactClient.getGroupDetail(
              account,
              params.chat_id as string,
            );
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `客户群详情已获取：${groupChat.name || params.chat_id}`,
              group_chat: groupChat,
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
