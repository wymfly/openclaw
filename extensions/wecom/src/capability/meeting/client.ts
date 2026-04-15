import { resolveWecomEgressProxyUrlFromNetwork } from "../../config/index.js";
import { wecomFetch } from "../../http.js";
import { getAccessToken } from "../../transport/agent-api/core.js";
import { LIMITS } from "../../types/constants.js";
import type { ResolvedAgentAccount } from "../../types/index.js";
import {
  isRetryableError,
  parseJsonResponse,
  readString,
  readStringArray,
  withoutErrFields,
} from "../shared-client-utils.js";
import type { WecomMeeting, WecomMeetingListItem, WecomMeetingSettings } from "./types.js";

function readOptionalSettings(value: unknown): WecomMeetingSettings | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as WecomMeetingSettings;
}

export class WecomMeetingClient {
  private async postWecomMeetingApi(params: {
    path: string;
    actionLabel: string;
    agent: ResolvedAgentAccount;
    body: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    const { path, actionLabel, agent, body } = params;

    const token = await getAccessToken(agent);
    const url = `https://qyapi.weixin.qq.com${path}?access_token=${encodeURIComponent(token)}`;
    const proxyUrl = resolveWecomEgressProxyUrlFromNetwork(agent.network);

    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await wecomFetch(
          url,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify(body ?? {}),
          },
          { proxyUrl, timeoutMs: LIMITS.REQUEST_TIMEOUT_MS },
        );

        return await parseJsonResponse(res, actionLabel);
      } catch (err) {
        if (!isRetryableError(err)) throw err;
        lastErr = err;
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    throw lastErr;
  }

  async create(
    agent: ResolvedAgentAccount,
    params: {
      title: string;
      start_time: string;
      end_time: string;
      invitees?: string[];
      password?: string;
      settings?: WecomMeetingSettings;
    },
  ): Promise<{ raw: Record<string, unknown>; meeting: WecomMeeting }> {
    const title = readString(params.title);
    const startTime = readString(params.start_time);
    const endTime = readString(params.end_time);
    if (!title) throw new Error("title required");
    if (!startTime) throw new Error("start_time required");
    if (!endTime) throw new Error("end_time required");

    const payload: Record<string, unknown> = {
      title,
      meeting_start: startTime,
      meeting_end: endTime,
    };
    const invitees = readStringArray(params.invitees);
    const password = readString(params.password);
    const settings = readOptionalSettings(params.settings);
    if (invitees.length > 0) payload.invitees = invitees;
    if (password) payload.password = password;
    if (settings) payload.settings = settings;

    const json = await this.postWecomMeetingApi({
      path: "/cgi-bin/meeting/create",
      actionLabel: "create",
      agent,
      body: payload,
    });

    const meetingPayload = (json.meeting_info ?? withoutErrFields(json)) as WecomMeeting;
    return { raw: json, meeting: meetingPayload };
  }

  async update(
    agent: ResolvedAgentAccount,
    meetingid: string,
    params: { title?: string; start_time?: string; end_time?: string },
  ): Promise<{ raw: Record<string, unknown>; meetingid: string }> {
    const normalizedMeetingId = readString(meetingid);
    if (!normalizedMeetingId) throw new Error("meetingid required");

    const payload: Record<string, unknown> = {
      meetingid: normalizedMeetingId,
    };

    if (params.title !== undefined) {
      const title = readString(params.title);
      if (!title) throw new Error("title must be a non-empty string");
      payload.title = title;
    }
    if (params.start_time !== undefined) {
      const startTime = readString(params.start_time);
      if (!startTime) throw new Error("start_time must be a non-empty string");
      payload.meeting_start = startTime;
    }
    if (params.end_time !== undefined) {
      const endTime = readString(params.end_time);
      if (!endTime) throw new Error("end_time must be a non-empty string");
      payload.meeting_end = endTime;
    }

    if (Object.keys(payload).length === 1) {
      throw new Error("at least one of title/start_time/end_time is required");
    }

    const json = await this.postWecomMeetingApi({
      path: "/cgi-bin/meeting/update",
      actionLabel: "update",
      agent,
      body: payload,
    });

    return { raw: json, meetingid: normalizedMeetingId };
  }

  async cancel(
    agent: ResolvedAgentAccount,
    meetingid: string,
  ): Promise<{ raw: Record<string, unknown>; meetingid: string }> {
    const normalizedMeetingId = readString(meetingid);
    if (!normalizedMeetingId) throw new Error("meetingid required");

    const json = await this.postWecomMeetingApi({
      path: "/cgi-bin/meeting/cancel",
      actionLabel: "cancel",
      agent,
      body: { meetingid: normalizedMeetingId },
    });

    return { raw: json, meetingid: normalizedMeetingId };
  }

  async getInfo(agent: ResolvedAgentAccount, meetingid: string): Promise<WecomMeeting> {
    const normalizedMeetingId = readString(meetingid);
    if (!normalizedMeetingId) throw new Error("meetingid required");

    const json = await this.postWecomMeetingApi({
      path: "/cgi-bin/meeting/get_info",
      actionLabel: "get_info",
      agent,
      body: { meetingid: normalizedMeetingId },
    });

    const info = (json.meeting_info ?? {}) as Record<string, unknown>;
    // Normalize WeCom API field names to our type (meeting_start → start_time)
    return {
      ...info,
      start_time: info.meeting_start ?? info.start_time ?? "",
      end_time: info.meeting_end ?? info.end_time ?? "",
    } as unknown as WecomMeeting;
  }

  async listUserMeetings(
    agent: ResolvedAgentAccount,
    userid: string,
  ): Promise<WecomMeetingListItem[]> {
    const normalizedUserId = readString(userid);
    if (!normalizedUserId) throw new Error("userid required");

    const json = await this.postWecomMeetingApi({
      path: "/cgi-bin/meeting/get_user_meetinglist",
      actionLabel: "list_user_meetings",
      agent,
      body: { userid: normalizedUserId },
    });

    return Array.isArray(json.meeting_list) ? (json.meeting_list as WecomMeetingListItem[]) : [];
  }
}
