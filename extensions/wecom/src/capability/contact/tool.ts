import type { OpenClawPluginApi } from "openclaw/plugin-sdk/wecom";
import { resolveAgentAccountOrUndefined } from "../bot/fallback-delivery.js";
import { WecomContactClient } from "./client.js";
import { wecomContactToolSchema } from "./schema.js";

const MEMBER_PRIVACY_NOTE =
  "自 2022-06-20 起，非通讯录同步应用调用 user/get 可能拿不到 avatar/mobile/email 等敏感字段。";

function buildToolResult(payload: any) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

export function registerWecomContactTools(api: OpenClawPluginApi) {
  if (typeof api?.registerTool !== "function") return;
  const contactClient = new WecomContactClient();

  api.registerTool((toolContext: any) => ({
    name: "wecom_contact",
    label: "WeCom Contact",
    description: "企业微信通讯录工具，支持成员、部门、标签成员查询以及本地搜索。",
    parameters: wecomContactToolSchema,
    async execute(_toolCallId, params: any) {
      try {
        const accountId = params.accountId || toolContext?.accountId || "default";
        const account = resolveAgentAccountOrUndefined(api.config, accountId);
        if (!account || !account.configured) {
          throw new Error(`WeCom account ${accountId} not configured for Contact API requirements`);
        }

        const action = params.action;
        switch (action) {
          case "get_member": {
            const result = await contactClient.getMember(account, params.userid);
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `成员信息已获取：${result.member.name || result.member.userid || params.userid}`,
              member: result.member,
              privacyNote: MEMBER_PRIVACY_NOTE,
              raw: result.raw,
            });
          }
          case "list_members": {
            const result = await contactClient.listMembers(
              account,
              Number(params.departmentId),
              Boolean(params.simple),
            );
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `成员列表已获取：${result.members.length} 人`,
              departmentId: result.departmentId,
              simple: result.simple,
              members: result.members,
              raw: result.raw,
            });
          }
          case "list_departments": {
            const result = await contactClient.listDepartments(account, params.parentId);
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `部门列表已获取：${result.departments.length} 个`,
              parentId: result.parentId,
              departments: result.departments,
              raw: result.raw,
            });
          }
          case "get_department": {
            const result = await contactClient.getDepartment(account, Number(params.departmentId));
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `部门信息已获取：${result.department.name || params.departmentId}`,
              department: result.department,
              raw: result.raw,
            });
          }
          case "list_tag_members": {
            const result = await contactClient.listTagMembers(account, Number(params.tagId));
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `标签成员已获取：${result.tag.userlist.length} 人，${result.tag.partylist.length} 个部门`,
              tag: result.tag,
              raw: result.raw,
            });
          }
          case "search": {
            const result = await contactClient.search(
              account,
              Number(params.departmentId),
              params.query,
            );
            return buildToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: `搜索完成：共 ${result.total} 人，匹配 ${result.members.length} 人`,
              departmentId: result.departmentId,
              query: result.query,
              total: result.total,
              members: result.members,
              raw: result.raw,
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
