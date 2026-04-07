import type { OpenClawPluginApi } from "openclaw/plugin-sdk/wecom";
import { resolveAgentAccountOrUndefined } from "../bot/fallback-delivery.js";
import { buildToolError, buildToolResult, type WecomToolContext } from "../shared-tool-types.js";
import { WecomMeetingClient } from "./client.js";
import { wecomMeetingToolSchema } from "./schema.js";
import type { WecomMeetingSettings } from "./types.js";

export function registerWecomMeetingTools(api: OpenClawPluginApi) {
  if (typeof api?.registerTool !== "function") return;
  const meetingClient = new WecomMeetingClient();

  api.registerTool((toolContext: WecomToolContext) => ({
    name: "wecom_meeting",
    label: "WeCom Meeting",
    description: "企业微信会议工具，支持创建、更新、取消及查询会议。",
    parameters: wecomMeetingToolSchema,
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      try {
        const accountId = (params.accountId as string) || toolContext?.accountId || "default";
        const account = resolveAgentAccountOrUndefined(api.config, accountId);
        if (!account || !account.configured) {
          throw new Error(`WeCom account ${accountId} not configured for Meeting API requirements`);
        }

        const action = params.action;
        switch (action) {
          case "create": {
            const result = await meetingClient.create(account, {
              title: params.title as string,
              start_time: params.start_time as string,
              end_time: params.end_time as string,
              invitees: params.invitees as string[] | undefined,
              password: params.password as string | undefined,
              settings: params.settings as WecomMeetingSettings | undefined,
            });
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `会议已创建：${result.meeting.title || params.title}`,
              meeting: result.meeting,
              raw: result.raw,
            });
          }
          case "update": {
            const result = await meetingClient.update(account, params.meetingid as string, {
              title: params.title as string | undefined,
              start_time: params.start_time as string | undefined,
              end_time: params.end_time as string | undefined,
            });
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `会议已更新：${result.meetingid}`,
              meetingid: result.meetingid,
              raw: result.raw,
            });
          }
          case "cancel": {
            const result = await meetingClient.cancel(account, params.meetingid as string);
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `会议已取消：${result.meetingid}`,
              meetingid: result.meetingid,
              raw: result.raw,
            });
          }
          case "get_info": {
            const meeting = await meetingClient.getInfo(account, params.meetingid as string);
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `会议信息已获取：${meeting.title || meeting.meetingid || params.meetingid}`,
              meeting,
            });
          }
          case "list_user_meetings": {
            const meetingList = await meetingClient.listUserMeetings(
              account,
              params.userid as string,
            );
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `用户会议列表已获取：${meetingList.length} 场`,
              userid: params.userid,
              meetingList,
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
