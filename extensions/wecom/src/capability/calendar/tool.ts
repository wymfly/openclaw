// ============================================================================
// Calendar Tool - Complete Implementation
// 严格遵循企业微信官方 API 文档：https://developer.work.weixin.qq.com/document/path/93329
// ============================================================================
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/wecom";
import { isWecomAgentSource } from "../../runtime/source-registry.js";
import type { ResolvedAgentAccount } from "../../types/index.js";
import { resolveAgentAccountOrUndefined } from "../bot/fallback-delivery.js";
import { buildToolResult, type WecomToolContext } from "../shared-tool-types.js";
import { WecomCalendarClient } from "./client.js";
import { wecomCalendarToolSchema } from "./schema.js";
import type {
  CalendarSharesEntry,
  CalendarPublicRange,
  ScheduleAttendee,
  ScheduleReminders,
} from "./types.js";

// ============================================================================
// Helper Functions
// ============================================================================

function readString(v: unknown): string {
  return String(v ?? "").trim();
}

function readNumber(v: unknown): number {
  const num = Number(v);
  return isNaN(num) ? 0 : num;
}

function readArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function resolveAccount(
  api: OpenClawPluginApi,
  paramsAccountId?: string,
  toolContext?: WecomToolContext,
): ResolvedAgentAccount | undefined {
  const accountId = paramsAccountId || toolContext?.accountId || "default";
  return resolveAgentAccountOrUndefined(api.config, accountId);
}

// ============================================================================
// Tool Registration
// ============================================================================

export function registerWecomCalendarTools(api: OpenClawPluginApi): void {
  if (typeof api?.registerTool !== "function") {
    return;
  }

  const client = new WecomCalendarClient();

  api.registerTool((toolContext: WecomToolContext) => {
    if (
      toolContext?.messageChannel !== "wecom" ||
      !isWecomAgentSource({
        accountId: (toolContext?.agentAccountId as string | undefined) || toolContext?.accountId,
        sessionKey: toolContext?.sessionKey as string | undefined,
        sessionId: toolContext?.sessionId as string | undefined,
      })
    ) {
      return null;
    }

    return {
      name: "wecom_calendar",
      label: "WeCom Calendar",
      description: "企业微信日历工具，支持创建/更新/删除日历和日程，获取日程详情等功能",
      parameters: wecomCalendarToolSchema,
      async execute(_toolCallId: string, params: Record<string, unknown>) {
        try {
          const account = resolveAccount(api, params.accountId as string | undefined, toolContext);

          if (!account || !account.configured) {
            return buildToolResult({
              ok: false,
              action: params.action,
              error: "账号未配置或不存在",
              accountId: params.accountId,
            });
          }

          switch (params.action) {
            // ========================================================================
            // Calendar APIs
            // ========================================================================

            case "calendar_create": {
              const r = await client.createCalendar({
                agent: account,
                request: {
                  calendar: {
                    summary: readString(params.summary),
                    color: readString(params.color),
                    description:
                      params.description !== undefined ? readString(params.description) : undefined,
                    admins: readArray(params.admins) as string[],
                    set_as_default: params.set_as_default as 0 | 1 | undefined,
                    shares: readArray(params.shares) as CalendarSharesEntry[],
                    is_public: params.is_public as 0 | 1 | undefined,
                    public_range: params.public_range as CalendarPublicRange | undefined,
                    is_corp_calendar: params.is_corp_calendar as 0 | 1 | undefined,
                  },
                  agentid: params.agentid as number | undefined,
                },
              });
              return buildToolResult({
                ok: true,
                action: "calendar_create",
                calId: r.calId,
                raw: r.raw,
              });
            }

            case "calendar_update": {
              const r = await client.updateCalendar({
                agent: account,
                request: {
                  skip_public_range: params.skip_public_range as 0 | 1 | undefined,
                  calendar: {
                    cal_id: readString(params.cal_id),
                    summary: readString(params.summary),
                    color: readString(params.color),
                    description:
                      params.description !== undefined ? readString(params.description) : undefined,
                    admins: readArray(params.admins) as string[],
                    shares: readArray(params.shares) as CalendarSharesEntry[],
                    public_range: params.public_range as CalendarPublicRange | undefined,
                  },
                },
              });
              return buildToolResult({
                ok: true,
                action: "calendar_update",
                calId: r.calId,
                raw: r.raw,
              });
            }

            case "calendar_get": {
              const r = await client.getCalendar({
                agent: account,
                request: {
                  cal_id_list: readArray(params.cal_id_list) as string[],
                },
              });
              return buildToolResult({
                ok: true,
                action: "calendar_get",
                calendarList: r.calendarList,
                raw: r.raw,
              });
            }

            case "calendar_delete": {
              const r = await client.deleteCalendar({
                agent: account,
                calId: readString(params.cal_id),
              });
              return buildToolResult({
                ok: true,
                action: "calendar_delete",
                calId: r.calId,
                raw: r.raw,
              });
            }

            // ========================================================================
            // Schedule APIs
            // ========================================================================

            case "schedule_create": {
              const r = await client.createSchedule({
                agent: account,
                request: {
                  schedule: {
                    start_time: readNumber(params.start_time),
                    end_time: readNumber(params.end_time),
                    is_whole_day: params.is_whole_day as 0 | 1 | undefined,
                    summary: params.summary !== undefined ? readString(params.summary) : undefined,
                    description:
                      params.description !== undefined ? readString(params.description) : undefined,
                    location:
                      params.location !== undefined ? readString(params.location) : undefined,
                    attendees: readArray(params.attendees) as ScheduleAttendee[],
                    admins: readArray(params.admins) as string[],
                    reminders: params.reminders as ScheduleReminders | undefined,
                    cal_id: params.cal_id !== undefined ? readString(params.cal_id) : undefined,
                  },
                  agentid: params.agentid as number | undefined,
                },
              });
              return buildToolResult({
                ok: true,
                action: "schedule_create",
                scheduleId: r.scheduleId,
                raw: r.raw,
              });
            }

            case "schedule_update": {
              const r = await client.updateSchedule({
                agent: account,
                request: {
                  skip_attendees: params.skip_attendees as 0 | 1 | undefined,
                  op_mode: params.op_mode as 0 | 1 | 2 | undefined,
                  op_start_time: params.op_start_time as number | undefined,
                  schedule: {
                    schedule_id: readString(params.schedule_id),
                    start_time: readNumber(params.start_time),
                    end_time: readNumber(params.end_time),
                    is_whole_day: params.is_whole_day as 0 | 1 | undefined,
                    summary: params.summary !== undefined ? readString(params.summary) : undefined,
                    description:
                      params.description !== undefined ? readString(params.description) : undefined,
                    location:
                      params.location !== undefined ? readString(params.location) : undefined,
                    attendees: readArray(params.attendees) as ScheduleAttendee[],
                    admins: readArray(params.admins) as string[],
                    reminders: params.reminders as ScheduleReminders | undefined,
                  },
                },
              });
              return buildToolResult({
                ok: true,
                action: "schedule_update",
                scheduleId: r.scheduleId,
                raw: r.raw,
              });
            }

            case "schedule_add_attendees": {
              const r = await client.addScheduleAttendees({
                agent: account,
                request: {
                  schedule_id: readString(params.schedule_id),
                  attendees: readArray(params.attendees) as ScheduleAttendee[],
                },
              });
              return buildToolResult({
                ok: true,
                action: "schedule_add_attendees",
                scheduleId: r.scheduleId,
                raw: r.raw,
              });
            }

            case "schedule_del_attendees": {
              const r = await client.deleteScheduleAttendees({
                agent: account,
                request: {
                  schedule_id: readString(params.schedule_id),
                  attendees: readArray(params.attendees) as ScheduleAttendee[],
                },
              });
              return buildToolResult({
                ok: true,
                action: "schedule_del_attendees",
                scheduleId: r.scheduleId,
                raw: r.raw,
              });
            }

            case "schedule_get_by_calendar": {
              const r = await client.getScheduleByCalendar({
                agent: account,
                request: {
                  cal_id: readString(params.cal_id),
                  offset: params.offset as number | undefined,
                  limit: params.limit as number | undefined,
                },
              });
              return buildToolResult({
                ok: true,
                action: "schedule_get_by_calendar",
                scheduleList: r.scheduleList,
                raw: r.raw,
              });
            }

            case "schedule_get": {
              const r = await client.getSchedule({
                agent: account,
                request: {
                  schedule_id_list: readArray(params.schedule_id_list) as string[],
                },
              });
              return buildToolResult({
                ok: true,
                action: "schedule_get",
                scheduleList: r.scheduleList,
                meetingCode: r.meetingCode,
                meetingLink: r.meetingLink,
                raw: r.raw,
              });
            }

            case "schedule_delete": {
              const r = await client.deleteSchedule({
                agent: account,
                request: {
                  schedule_id: readString(params.schedule_id),
                  op_mode: params.op_mode as 0 | 1 | 2 | undefined,
                  op_start_time: params.op_start_time as number | undefined,
                },
              });
              return buildToolResult({
                ok: true,
                action: "schedule_delete",
                scheduleId: r.scheduleId,
                raw: r.raw,
              });
            }

            // ========================================================================
            // System Calendar APIs
            // ========================================================================

            case "schedule_get_system_calid": {
              const r = await client.getSystemCalendarId({
                agent: account,
                userid: readString(params.userid),
              });
              return buildToolResult({
                ok: true,
                action: "schedule_get_system_calid",
                calId: r.calId,
                raw: r.raw,
              });
            }

            case "schedule_create_in_system": {
              const r = await client.createSystemSchedule({
                agent: account,
                request: {
                  schedule: {
                    organizer: readString(params.organizer),
                    start_time: readNumber(params.start_time),
                    end_time: readNumber(params.end_time),
                    is_whole_day: params.is_whole_day as 0 | 1 | undefined,
                    summary: params.summary !== undefined ? readString(params.summary) : undefined,
                    description:
                      params.description !== undefined ? readString(params.description) : undefined,
                    location:
                      params.location !== undefined ? readString(params.location) : undefined,
                    attendees: readArray(params.attendees) as ScheduleAttendee[],
                    reminders: params.reminders as ScheduleReminders | undefined,
                  },
                },
              });
              return buildToolResult({
                ok: true,
                action: "schedule_create_in_system",
                scheduleId: r.scheduleId,
                raw: r.raw,
              });
            }

            case "schedule_respond": {
              const r = await client.respondSchedule({
                agent: account,
                request: {
                  schedule_id: readString(params.schedule_id),
                  op_mode: params.op_mode as 0 | 1 | 2 | undefined,
                  op_start_time: params.op_start_time as number | undefined,
                  attendee: readString(params.attendee),
                  response_status: params.response_status as 1 | 2 | 4,
                },
              });
              return buildToolResult({
                ok: true,
                action: "schedule_respond",
                scheduleId: r.scheduleId,
                raw: r.raw,
              });
            }

            case "schedule_sync": {
              const r = await client.syncSchedule({
                agent: account,
                request: {
                  cal_id: readString(params.cal_id),
                  cursor: params.cursor as string | undefined,
                  limit: params.limit as number | undefined,
                },
              });
              return buildToolResult({
                ok: true,
                action: "schedule_sync",
                nextCursor: r.nextCursor,
                scheduleList: r.scheduleList,
                raw: r.raw,
              });
            }

            // ========================================================================
            // Default: Unknown Action
            // ========================================================================

            default:
              throw new Error(`未知操作：${params.action}`);
          }
        } catch (err) {
          return buildToolResult({
            ok: false,
            action: params.action,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    };
  });
}
