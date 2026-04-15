// extensions/wecom/src/capability/external-contact/client.ts

import { resolveWecomEgressProxyUrlFromNetwork } from "../../config/index.js";
import { wecomFetch } from "../../http.js";
import { getAccessToken } from "../../transport/agent-api/core.js";
import { LIMITS } from "../../types/constants.js";
import type { ResolvedAgentAccount } from "../../types/index.js";
import { isRetryableError, parseJsonResponse, readString } from "../shared-client-utils.js";
import type {
  WecomExternalContactDetail,
  WecomGroupChat,
  WecomGroupChatListResult,
} from "./types.js";

export class WecomExternalContactClient {
  private async getWecomExternalContactApi(params: {
    path: string;
    actionLabel: string;
    agent: ResolvedAgentAccount;
    query?: Record<string, string>;
  }): Promise<Record<string, unknown>> {
    const { path, actionLabel, agent, query } = params;
    const token = await getAccessToken(agent);
    const qs = new URLSearchParams({ access_token: token, ...query });
    const url = `https://qyapi.weixin.qq.com${path}?${qs.toString()}`;
    const proxyUrl = resolveWecomEgressProxyUrlFromNetwork(agent.network);

    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await wecomFetch(
          url,
          { method: "GET" },
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

  private async postWecomExternalContactApi(params: {
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
            headers: { "content-type": "application/json" },
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

  async get(
    agent: ResolvedAgentAccount,
    externalUserid: string,
  ): Promise<WecomExternalContactDetail> {
    const normalizedId = readString(externalUserid);
    if (!normalizedId) throw new Error("external_userid required");

    const json = await this.getWecomExternalContactApi({
      path: "/cgi-bin/externalcontact/get",
      actionLabel: "get",
      agent,
      query: { external_userid: normalizedId },
    });

    return {
      external_contact: json.external_contact ?? {},
      follow_user: Array.isArray(json.follow_user) ? json.follow_user : [],
    } as WecomExternalContactDetail;
  }

  async list(agent: ResolvedAgentAccount, userid: string): Promise<string[]> {
    const normalizedUserId = readString(userid);
    if (!normalizedUserId) throw new Error("userid required");

    const json = await this.getWecomExternalContactApi({
      path: "/cgi-bin/externalcontact/list",
      actionLabel: "list",
      agent,
      query: { userid: normalizedUserId },
    });

    return Array.isArray(json.external_userid) ? (json.external_userid as string[]) : [];
  }

  async listGroups(
    agent: ResolvedAgentAccount,
    params?: {
      status_filter?: number;
      owner_filter?: { userid_list?: string[] };
      cursor?: string;
      limit?: number;
    },
  ): Promise<WecomGroupChatListResult> {
    const payload: Record<string, unknown> = {};
    if (params?.status_filter !== undefined) {
      payload.status_filter = params.status_filter;
    }
    if (params?.owner_filter) {
      payload.owner_filter = params.owner_filter;
    }
    if (params?.cursor) {
      payload.cursor = readString(params.cursor);
    }
    if (params?.limit !== undefined) {
      payload.limit = params.limit;
    }

    const json = await this.postWecomExternalContactApi({
      path: "/cgi-bin/externalcontact/groupchat/list",
      actionLabel: "list_groups",
      agent,
      body: payload,
    });

    return {
      group_chat_list: Array.isArray(json.group_chat_list) ? json.group_chat_list : [],
      next_cursor: json.next_cursor || undefined,
    } as WecomGroupChatListResult;
  }

  async getGroupDetail(agent: ResolvedAgentAccount, chatId: string): Promise<WecomGroupChat> {
    const normalizedChatId = readString(chatId);
    if (!normalizedChatId) throw new Error("chat_id required");

    const json = await this.postWecomExternalContactApi({
      path: "/cgi-bin/externalcontact/groupchat/get",
      actionLabel: "get_group_detail",
      agent,
      body: { chat_id: normalizedChatId, need_name: 1 },
    });

    const groupChat = (json.group_chat ?? {}) as Record<string, unknown>;
    const memberList = Array.isArray(groupChat.member_list) ? groupChat.member_list : [];

    return {
      chat_id: readString(groupChat.chat_id) || normalizedChatId,
      name: readString(groupChat.name) || undefined,
      owner: readString(groupChat.owner) || undefined,
      create_time: typeof groupChat.create_time === "number" ? groupChat.create_time : undefined,
      notice: readString(groupChat.notice) || undefined,
      member_count: memberList.length || undefined,
      status: typeof groupChat.status === "number" ? groupChat.status : 0,
    } as WecomGroupChat;
  }
}
