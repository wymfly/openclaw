import fs from "node:fs";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/wecom";
import { getAccountRuntime } from "../../runtime.js";
import { resolveAgentAccountOrUndefined } from "../bot/fallback-delivery.js";
import {
  buildToolError,
  buildToolResult as buildBaseToolResult,
  type WecomToolContext,
} from "../shared-tool-types.js";
import { WecomDocClient } from "./client.js";
import { wecomDocToolSchema } from "./schema.js";
import { UpdateRequest } from "./types.js";

function readString(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return "";
  }
  const trimmed = String(value).trim();
  return trimmed || "";
}

function readFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const text = readString(value);
  if (!text) {
    return undefined;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapDocTypeLabel(docType: number): string {
  if (docType === 10) {
    return "智能表格";
  }
  return docType === 4 ? "表格" : "文档";
}

function summarizeDocInfo(info: Record<string, unknown> = {}) {
  const docName = readString(info.doc_name) || "未命名文档";
  const docType = mapDocTypeLabel(Number(info.doc_type));
  return `${docType}"${docName}"信息已获取`;
}

function summarizeDocAuth(result: Record<string, unknown> = {}) {
  const collaborators = uniqueRefs([
    ...mapDocMemberList(result.docMembers, (auth) => auth === 2 || auth === 7),
    ...mapDocMemberList(result.coAuthList),
  ]);
  const collaboratorRefs = new Set(collaborators);
  const viewers = uniqueRefs(
    mapDocMemberList(result.docMembers, (auth) => auth === null || auth === 1).filter(
      (ref) => !collaboratorRefs.has(ref),
    ),
  );
  return `权限信息已获取：通知成员 ${viewers.length}，协作者 ${collaborators.length}`;
}

function readBooleanFlag(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function formatDocMemberRef(value: Record<string, unknown>) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }
  const userid = readString(value.userid ?? value.userId);
  if (userid) {
    return `userid:${userid}`;
  }
  const tmpExternalUserid = readString(value.tmp_external_userid ?? value.tmpExternalUserid);
  if (tmpExternalUserid) {
    return `tmp_external_userid:${tmpExternalUserid}`;
  }
  const partyid = readString(value.partyid);
  if (partyid) {
    return `partyid:${partyid}`;
  }
  const tagid = readString(value.tagid);
  if (tagid) {
    return `tagid:${tagid}`;
  }
  return "";
}

function readMemberAuth(value: Record<string, unknown>) {
  const normalized = Number(value.auth);
  return Number.isFinite(normalized) ? normalized : null;
}

function uniqueRefs(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function mapDocMemberList(values: unknown, acceptAuth?: (auth: number | null) => boolean) {
  return Array.isArray(values)
    ? values
        .map((item: Record<string, unknown>) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return "";
          }
          const auth = readMemberAuth(item);
          if (acceptAuth && !acceptAuth(auth)) {
            return "";
          }
          return formatDocMemberRef(item);
        })
        .filter(Boolean)
    : [];
}

function describeFlagState(
  value: boolean | null,
  enabledLabel: string,
  disabledLabel: string,
  unknownLabel = "未知",
) {
  if (value === true) {
    return enabledLabel;
  }
  if (value === false) {
    return disabledLabel;
  }
  return unknownLabel;
}

function buildDocAuthDiagnosis(result: Record<string, unknown> = {}, requesterSenderId = "") {
  const accessRule =
    result.accessRule && typeof result.accessRule === "object"
      ? (result.accessRule as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const collaborators = uniqueRefs([
    ...mapDocMemberList(result.docMembers, (auth) => auth === 2 || auth === 7),
    ...mapDocMemberList(result.coAuthList),
  ]);
  const collaboratorRefs = new Set(collaborators);
  const viewers = uniqueRefs(
    mapDocMemberList(result.docMembers, (auth) => auth === null || auth === 1).filter(
      (ref) => !collaboratorRefs.has(ref),
    ),
  );
  const requester = readString(requesterSenderId);
  const requesterViewerRef = requester ? `userid:${requester}` : "";
  const requesterIsViewer = requesterViewerRef ? viewers.includes(requesterViewerRef) : false;
  const requesterIsCollaborator = requesterViewerRef
    ? collaborators.includes(requesterViewerRef)
    : false;
  const internalAccessEnabled = readBooleanFlag(accessRule.enable_corp_internal);
  const externalAccessEnabled = readBooleanFlag(accessRule.enable_corp_external);
  const externalShareAllowed =
    typeof accessRule.ban_share_external === "boolean" ? !accessRule.ban_share_external : null;
  const likelyAnonymousLinkFailure =
    internalAccessEnabled === true && externalAccessEnabled === false;
  const findings = [
    `企业内访问：${describeFlagState(internalAccessEnabled, "开启", "关闭")}`,
    `企业外访问：${describeFlagState(externalAccessEnabled, "开启", "关闭")}`,
    `外部分享：${describeFlagState(externalShareAllowed, "允许", "禁止")}`,
    `查看成员：${viewers.length}`,
    `协作者：${collaborators.length}`,
  ];
  const recommendations: string[] = [];
  if (likelyAnonymousLinkFailure) {
    recommendations.push(
      '当前更像是仅企业内可访问；匿名浏览器或未登录企业微信环境通常会显示"文档不存在"。',
    );
  }
  if (requester) {
    if (requesterIsCollaborator) {
      recommendations.push(`当前请求人 ${requester} 已在协作者列表中。`);
    } else if (requesterIsViewer) {
      recommendations.push(`当前请求人 ${requester} 已在查看成员列表中，但还不是协作者。`);
    } else {
      recommendations.push(`当前请求人 ${requester} 不在查看成员或协作者列表中。`);
    }
  }
  return {
    internalAccessEnabled,
    externalAccessEnabled,
    externalShareAllowed,
    viewerCount: viewers.length,
    collaboratorCount: collaborators.length,
    viewers,
    collaborators,
    requesterSenderId: requester || undefined,
    requesterRole: requesterIsCollaborator
      ? "collaborator"
      : requesterIsViewer
        ? "viewer"
        : requester
          ? "none"
          : "unknown",
    likelyAnonymousLinkFailure,
    findings,
    recommendations,
  };
}

function summarizeDocAuthDiagnosis(diagnosis: Record<string, unknown> = {}) {
  const parts = Array.isArray(diagnosis.findings) ? diagnosis.findings : [];
  return parts.length > 0 ? `文档权限诊断：${parts.join("，")}` : "文档权限诊断已完成";
}

function buildDocIdUsageHint(docId?: string) {
  const normalizedDocId = readString(docId);
  if (!normalizedDocId) {
    return "";
  }
  return `后续权限、分享和诊断操作请使用真实 docId：${normalizedDocId}；不要直接使用分享链接路径中的片段。`;
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractEmbeddedJson(html: string, variableName: string) {
  const source = html;
  if (!source) {
    return null;
  }
  const marker = `window.${variableName}=`;
  const start = source.indexOf(marker);
  if (start < 0) {
    return null;
  }
  const valueStart = start + marker.length;
  const end = source.indexOf(";</script>", valueStart);
  if (end < 0) {
    return null;
  }
  return safeParseJson(source.slice(valueStart, end));
}

function buildShareLinkDiagnosis(params: {
  shareUrl: string;
  finalUrl: string;
  status: number;
  contentType: string;
  basicClientVars: Record<string, unknown> | null;
}) {
  const { shareUrl, finalUrl, status, contentType, basicClientVars } = params;
  const parsedUrl = new URL(finalUrl || shareUrl);
  const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
  const pathResourceType = readString(pathSegments[0]);
  const pathResourceId = readString(pathSegments[1]);
  const shareCode = readString(parsedUrl.searchParams.get("scode"));
  const userInfo = (
    basicClientVars?.userInfo && typeof basicClientVars.userInfo === "object"
      ? basicClientVars.userInfo
      : {}
  ) as Record<string, unknown>;
  const docInfo = (
    basicClientVars?.docInfo && typeof basicClientVars.docInfo === "object"
      ? basicClientVars.docInfo
      : {}
  ) as Record<string, unknown>;
  const padInfo = (
    docInfo?.padInfo && typeof docInfo.padInfo === "object" ? docInfo.padInfo : {}
  ) as Record<string, unknown>;
  const ownerInfo = (
    docInfo?.ownerInfo && typeof docInfo.ownerInfo === "object" ? docInfo.ownerInfo : {}
  ) as Record<string, unknown>;
  const shareInfo = (
    docInfo?.shareInfo && typeof docInfo.shareInfo === "object" ? docInfo.shareInfo : {}
  ) as Record<string, unknown>;
  const aclInfo = (
    docInfo?.aclInfo && typeof docInfo.aclInfo === "object" ? docInfo.aclInfo : {}
  ) as Record<string, unknown>;
  const userType = readString(userInfo.userType);
  const padType = readString(padInfo.padType);
  const padId = readString(padInfo.padId);
  const padTitle = readString(padInfo.padTitle);
  const isGuest = userType === "guest" || Number(userInfo.loginType) === 0;
  const isBlankPage = padType === "blankpage";
  const likelyUnavailableToGuest = isGuest && isBlankPage && !padTitle;
  const findings = [
    `HTTP ${String(status || "")}`.trim(),
    `内容类型：${readString(contentType) || "未知"}`,
    `访问身份：${userType || "未知"}`,
    `页面类型：${padType || "未知"}`,
    `路径资源：${pathResourceType || "未知"} / ${pathResourceId || "未知"}`,
  ];
  const recommendations: string[] = [];
  if (likelyUnavailableToGuest) {
    recommendations.push(
      '当前链接对 guest/未登录企业微信环境返回 blankpage，外部访问会表现为打不开或像"文档不存在"。',
    );
  }
  if (shareCode) {
    recommendations.push(
      `当前链接带有分享码 scode=${shareCode}。如分享码过期或未生效，外部访问会失败。`,
    );
  }
  if (pathResourceId && padId && pathResourceId !== padId) {
    recommendations.push(
      `链接路径中的资源标识与页面 padId 不一致：path=${pathResourceId}，padId=${padId}。`,
    );
  }
  if (pathResourceId && padId && pathResourceId === padId) {
    recommendations.push(
      "链接路径资源标识与页面 padId 一致，但这仍不等同于 Wedoc API 可用的真实 docId。",
    );
  }
  return {
    shareUrl,
    finalUrl,
    httpStatus: status,
    contentType: readString(contentType) || undefined,
    pathResourceType: pathResourceType || undefined,
    pathResourceId: pathResourceId || undefined,
    shareCode: shareCode || undefined,
    userType: userType || undefined,
    isGuest,
    padId: padId || undefined,
    padType: padType || undefined,
    padTitle: padTitle || undefined,
    ownerId: readString(ownerInfo.ownerId) || undefined,
    hasShareInfo: Object.keys(shareInfo).length > 0,
    hasAclInfo: Object.keys(aclInfo).length > 0,
    likelyUnavailableToGuest,
    findings,
    recommendations,
  };
}

async function inspectWecomShareLink(params: { shareUrl: string }) {
  const { shareUrl } = params;
  const normalizedUrl = readString(shareUrl);
  if (!normalizedUrl) {
    throw new Error("shareUrl required");
  }
  let parsed;
  try {
    parsed = new URL(normalizedUrl);
  } catch {
    throw new Error("shareUrl must be a valid URL");
  }
  // To protect URLs containing underscores from markdown italic corruption in output, we ensure we return exactly what we got or wrap it later.

  const response = await fetch(parsed.toString(), {
    headers: {
      "user-agent": "OpenClaw-Wechat/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });
  const contentType = response.headers?.get("content-type") || "";
  const html = await response.text();
  const basicClientVars = extractEmbeddedJson(html, "basicClientVars");
  const diagnosis = buildShareLinkDiagnosis({
    shareUrl: normalizedUrl,
    finalUrl: response.url || parsed.toString(),
    status: response.status,
    contentType,
    basicClientVars,
  });
  return {
    raw: {
      httpStatus: response.status,
      // Markdown italic protection for URLs
      finalUrl: `\u00A0${response.url || parsed.toString()}\u00A0`.trim(),
      contentType,
      basicClientVars,
    },
    diagnosis,
  };
}

function summarizeShareLinkDiagnosis(diagnosis: Record<string, unknown> = {}) {
  const parts = Array.isArray(diagnosis.findings) ? diagnosis.findings : [];
  return parts.length > 0 ? `分享链接校验：${parts.join("，")}` : "分享链接校验已完成";
}

function summarizeSheetProperties(result: Record<string, unknown> = {}) {
  const properties = Array.isArray(result.properties) ? result.properties : [];
  return `表格属性已获取：工作表 ${properties.length}`;
}

function summarizeDocAccess(result: Record<string, unknown> = {}) {
  const parts = [];
  const addedViewerCount = readFiniteNumber(result.addedViewerCount);
  const addedCollaboratorCount = readFiniteNumber(result.addedCollaboratorCount);
  const removedViewerCount = readFiniteNumber(result.removedViewerCount);
  const removedCollaboratorCount = readFiniteNumber(result.removedCollaboratorCount);
  if (addedViewerCount) {
    parts.push(`新增查看成员 ${addedViewerCount}`);
  }
  if (addedCollaboratorCount) {
    parts.push(`新增协作者 ${addedCollaboratorCount}`);
  }
  if (removedViewerCount) {
    parts.push(`移除查看成员 ${removedViewerCount}`);
  }
  if (removedCollaboratorCount) {
    parts.push(`移除协作者 ${removedCollaboratorCount}`);
  }
  return parts.length > 0 ? `文档权限已更新：${parts.join("，")}` : "文档权限已更新";
}

function summarizeFormInfo(result: Record<string, unknown> = {}) {
  const formInfo = result.formInfo as Record<string, unknown> | undefined;
  const title = readString(formInfo?.form_title) || "未命名收集表";
  return `收集表"${title}"信息已获取`;
}

function summarizeFormAnswer(result: Record<string, unknown> = {}) {
  const answerList = Array.isArray(result.answerList) ? result.answerList : [];
  return `收集表答案已获取：字段 ${answerList.length}`;
}

function summarizeFormStatistic(result: Record<string, unknown> = {}) {
  const items = Array.isArray(result.items) ? result.items : [];
  return `收集表统计已获取：请求 ${items.length}，成功 ${readFiniteNumber(result.successCount) ?? 0}`;
}

function summarizeAdvancedAccount(result: Record<string, unknown> = {}, action: string) {
  const jobId = readString(result.jobid) || "未知";
  if (action === "assign") {
    return `高级功能账号分配任务已提交，jobid: ${jobId}`;
  }
  if (action === "cancel") {
    return `高级功能账号取消任务已提交，jobid: ${jobId}`;
  }
  const userList = Array.isArray(result.userList) ? result.userList : [];
  return `高级功能账号列表已获取：${userList.length} 个`;
}

function buildDocToolResult(payload: Record<string, unknown>) {
  // To avoid formatting issues with URLs having underscores rendering as markdown Italics
  const url = readString(payload.url);
  if (url) {
    payload.url = `<${url}>`;
  }
  const diagnosis = payload.diagnosis as Record<string, unknown> | undefined;
  const finalUrl = readString(diagnosis?.finalUrl);
  if (finalUrl && diagnosis) {
    diagnosis.finalUrl = `<${finalUrl}>`;
  }
  const shareUrl = readString(diagnosis?.shareUrl);
  if (shareUrl && diagnosis) {
    diagnosis.shareUrl = `<${shareUrl}>`;
  }
  return buildBaseToolResult(payload);
}

export function registerWecomDocTools(api: OpenClawPluginApi) {
  if (typeof api?.registerTool !== "function") {
    return;
  }
  const docClient = new WecomDocClient();

  api.registerTool((toolContext: WecomToolContext) => ({
    name: "wecom_doc",
    label: "WeCom Doc",
    description:
      "企业微信文档工具。支持文档/表格/收集表完整CRUD操作、查看/协作者权限配置、属性查询以及分享打不开可用性诊断功能。",
    parameters: wecomDocToolSchema,
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      try {
        let accountId = (params.accountId as string) || toolContext?.accountId || "default";
        const account = resolveAgentAccountOrUndefined(api.config, accountId);
        if (!account || !account.configured) {
          throw new Error(`WeCom account ${accountId} not configured for Doc API requirements`);
        }

        const action = params.action;
        switch (action) {
          case "create": {
            const explicitCollaborators = Array.isArray(params.collaborators)
              ? [...params.collaborators]
              : [];
            const result = await docClient.createDoc({
              agent: account,
              docName: params.docName as string,
              docType: params.docType,
              spaceId: params.spaceId as string | undefined,
              fatherId: params.fatherId as string | undefined,
              adminUsers: params.adminUsers as string[] | undefined,
            });

            // Auto-set security rules for a reachable default. WeCom join-rule auth only accepts read-only.
            try {
              await docClient.setDocJoinRule({
                agent: account,
                docId: result.docId,
                request: {
                  enable_corp_internal: true,
                  corp_internal_auth: 1,
                  enable_corp_external: false,
                  ban_share_external: false,
                },
              });
            } catch {
              // Non-fatal: document created, just default permissions may be read-only
            }

            // Handle initial content (title/body separation) if provided
            // Supports: string (text) or {type: "text"|"image", content/url: string}
            let contentResult: string | null = null;
            if (Array.isArray(params.init_content) && params.init_content.length > 0) {
              try {
                // Helper: check if content item is an image
                const isImageItem = (item: unknown): boolean => {
                  if (typeof item === "object" && item !== null) {
                    const obj = item as Record<string, unknown>;
                    return obj.type === "image" || (!!obj.url && !obj.content);
                  }
                  if (typeof item === "string") {
                    // Detect image URLs
                    return (
                      item.startsWith("http") &&
                      (item.includes(".png") ||
                        item.includes(".jpg") ||
                        item.includes(".jpeg") ||
                        item.includes(".gif") ||
                        item.includes("qpic.cn") ||
                        item.includes("weixin.qq.com"))
                    );
                  }
                  return false;
                };

                // Helper: get image URL from content item
                const getImageUrl = (item: unknown): string => {
                  if (typeof item === "object" && item !== null) {
                    const obj = item as Record<string, unknown>;
                    return readString(obj.url) || readString(obj.content);
                  }
                  return readString(item);
                };

                // Helper: download image and convert to base64
                const downloadImageAsBase64 = async (url: string): Promise<string> => {
                  const response = await fetch(url);
                  if (!response.ok) {
                    throw new Error(`Failed to download image: ${url}`);
                  }
                  const arrayBuffer = await response.arrayBuffer();
                  return Buffer.from(arrayBuffer).toString("base64");
                };

                // Helper: get text from content item
                const getText = (item: unknown): string => {
                  if (typeof item === "object" && item !== null) {
                    const obj = item as Record<string, unknown>;
                    return readString(obj.content) || readString(obj.text);
                  }
                  return readString(item);
                };

                if (params.init_content.every((item) => !isImageItem(item))) {
                  const textItems = params.init_content
                    .map(getText)
                    .filter((text) => text.length > 0);
                  const fullText = textItems.join("\n");
                  if (fullText) {
                    await docClient.updateDocContent({
                      agent: account,
                      docId: result.docId,
                      requests: [
                        {
                          insert_text: {
                            text: fullText,
                            location: { index: 0 },
                          },
                        },
                      ],
                    });

                    const titleText = textItems[0] || "";
                    if (titleText.length > 0) {
                      await docClient.updateDocContent({
                        agent: account,
                        docId: result.docId,
                        requests: [
                          {
                            update_text_property: {
                              text_property: { bold: true },
                              ranges: [{ start_index: 0, length: titleText.length }],
                            },
                          },
                        ],
                      });
                    }
                  }
                } else {
                  // Step 1: Insert first paragraph (title) at index 0
                  if (params.init_content[0]) {
                    const firstItem = params.init_content[0];
                    if (isImageItem(firstItem)) {
                      // First item is image - upload first, then insert at index 0
                      const imgUrl = getImageUrl(firstItem);

                      try {
                        // Upload image to WeCom to get proper image_id
                        const base64 = await downloadImageAsBase64(imgUrl);
                        const uploadResult = await docClient.uploadDocImage({
                          agent: account,
                          docId: result.docId,
                          base64_content: base64,
                        });

                        // Insert image using uploaded URL
                        // Note: version is optional, API handles concurrency
                        await docClient.updateDocContent({
                          agent: account,
                          docId: result.docId,
                          requests: [
                            {
                              insert_image: {
                                image_id: uploadResult.url,
                                location: { index: 0 },
                                width: uploadResult.width as number | undefined,
                                height: uploadResult.height as number | undefined,
                              },
                            },
                          ],
                        });
                      } catch (uploadErr) {
                        getAccountRuntime(account.accountId)?.log.error?.(
                          `Failed to upload first image ${imgUrl}: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`,
                        );
                        throw new Error(
                          `First image upload failed: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`,
                          { cause: uploadErr },
                        );
                      }
                    } else {
                      const titleText = getText(firstItem);
                      await docClient.updateDocContent({
                        agent: account,
                        docId: result.docId,
                        requests: [
                          {
                            insert_text: {
                              text: titleText,
                              location: { index: 0 },
                            },
                          },
                        ],
                      });

                      // Apply Title Styling (Bold)
                      if (titleText.length > 0) {
                        await docClient.updateDocContent({
                          agent: account,
                          docId: result.docId,
                          requests: [
                            {
                              update_text_property: {
                                text_property: { bold: true },
                                ranges: [{ start_index: 0, length: titleText.length }],
                              },
                            },
                          ],
                        });
                      }
                    }
                  }

                  // Step 2: For subsequent items, append with proper paragraph handling
                  // Per API spec: must get latest version and index before each batch_update
                  for (let i = 1; i < params.init_content.length; i++) {
                    const item = params.init_content[i];

                    // Refresh content to get latest document structure and version
                    // API requires: version difference ≤ 100 from latest
                    const currentContent = await docClient.getDocContent({
                      agent: account,
                      docId: result.docId,
                    });

                    // Get the end index of the document
                    const docEndIndex = currentContent.document.end;
                    const currentVersion = currentContent.version;

                    if (isImageItem(item)) {
                      // Insert image: upload first, then create paragraph, then insert image
                      const imgUrl = getImageUrl(item);

                      try {
                        // Step 1: Download and upload image to WeCom
                        const base64 = await downloadImageAsBase64(imgUrl);
                        const uploadResult = await docClient.uploadDocImage({
                          agent: account,
                          docId: result.docId,
                          base64_content: base64,
                        });

                        // Step 2: Create new paragraph and insert image in one batch (2 operations ≤ 30)
                        // Per API spec: all indices are based on the same document snapshot
                        // insert_paragraph at docEndIndex creates a new paragraph
                        // insert_image at docEndIndex + 1 inserts into the newly created paragraph
                        await docClient.updateDocContent({
                          agent: account,
                          docId: result.docId,
                          version: currentVersion, // Pass version for concurrency control
                          requests: [
                            {
                              insert_paragraph: {
                                location: { index: docEndIndex },
                              },
                            },
                            {
                              insert_image: {
                                image_id: uploadResult.url,
                                location: { index: docEndIndex + 1 },
                                width: uploadResult.width as number | undefined,
                                height: uploadResult.height as number | undefined,
                              },
                            },
                          ],
                        });
                      } catch (uploadErr) {
                        getAccountRuntime(account.accountId)?.log.error?.(
                          `Failed to upload image ${imgUrl}: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`,
                        );
                        throw new Error(
                          `Image upload failed: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`,
                          { cause: uploadErr },
                        );
                      }
                    } else {
                      const text = getText(item);
                      if (!text) {
                        continue;
                      }

                      // Insert text: create paragraph and insert text in one batch (2 operations ≤ 30)
                      // Per API spec: all indices are based on the same document snapshot
                      // insert_paragraph at docEndIndex creates a new paragraph
                      // insert_text at docEndIndex + 1 inserts into the newly created paragraph
                      await docClient.updateDocContent({
                        agent: account,
                        docId: result.docId,
                        version: currentVersion, // Pass version for concurrency control
                        requests: [
                          {
                            insert_paragraph: {
                              location: { index: docEndIndex },
                            },
                          },
                          {
                            insert_text: {
                              text: text,
                              location: { index: docEndIndex + 1 },
                            },
                          },
                        ],
                      });
                    }
                  }
                }
                contentResult = "init_content_populated";
              } catch (err) {
                contentResult = `content_failed: ${err instanceof Error ? err.message : String(err)}`;
              }
            }

            let accessResult: Record<string, unknown> | null = null;
            if (
              (Array.isArray(params.viewers) && params.viewers.length > 0) ||
              explicitCollaborators.length > 0
            ) {
              try {
                accessResult = await docClient.grantDocAccess({
                  agent: account,
                  docId: result.docId,
                  viewers: params.viewers,
                  collaborators: explicitCollaborators,
                });
              } catch (err) {
                return buildDocToolResult({
                  ok: false,
                  partial: true,
                  action: "create",
                  accountId: account.accountId,
                  resourceType: result.docTypeLabel,
                  canonicalDocId: result.docId,
                  docId: result.docId,
                  title: readString(params.docName),
                  url: result.url || undefined,
                  summary: `已创建${mapDocTypeLabel(result.docType)}"${readString(params.docName)}"（docId: ${result.docId}），但权限授予失败`,
                  usageHint: buildDocIdUsageHint(result.docId) || undefined,
                  error: err instanceof Error ? err.message : String(err),
                  raw: { create: result.raw },
                });
              }
            }
            return buildDocToolResult({
              ok: true,
              action: "create",
              accountId: account.accountId,
              resourceType: result.docTypeLabel,
              canonicalDocId: result.docId,
              docId: result.docId,
              title: readString(params.docName),
              url: result.url || undefined,
              summary: accessResult
                ? `已创建${mapDocTypeLabel(result.docType)}"${readString(params.docName)}"（docId: ${result.docId}）；${summarizeDocAccess(accessResult)}` +
                  (contentResult ? `；内容填充: ${contentResult}` : "")
                : `已创建${mapDocTypeLabel(result.docType)}"${readString(params.docName)}"（docId: ${result.docId}）` +
                  (contentResult ? `；内容填充: ${contentResult}` : ""),
              usageHint: buildDocIdUsageHint(result.docId) || undefined,
              raw: accessResult ? { create: result.raw, access: accessResult.raw } : result.raw,
            });
          }
          case "rename": {
            const result = await docClient.renameDoc({
              agent: account,
              docId: params.docId as string,
              newName: params.newName as string,
            });
            return buildDocToolResult({
              ok: true,
              action: "rename",
              accountId: account.accountId,
              docId: result.docId,
              title: result.newName,
              summary: `文档已重命名为"${result.newName}"`,
              raw: result.raw,
            });
          }
          case "copy": {
            const result = await docClient.copyDoc({
              agent: account,
              docId: params.docId as string,
              newName: params.newName as string | undefined,
              spaceId: params.spaceId as string | undefined,
              fatherId: params.fatherId as string | undefined,
            });
            return buildDocToolResult({
              ok: true,
              action: "copy",
              accountId: account.accountId,
              docId: result.docId,
              summary: `文档已成功复制，新 docId: ${result.docId}`,
              raw: result.raw,
            });
          }
          case "get_info": {
            const result = await docClient.getDocBaseInfo({
              agent: account,
              docId: params.docId as string,
            });
            const info = result.info as Record<string, unknown>;
            return buildDocToolResult({
              ok: true,
              action: "get_info",
              accountId: account.accountId,
              docId: params.docId as string,
              title: readString(info?.doc_name) || undefined,
              resourceType:
                Number(info?.doc_type) === 10
                  ? "smart_table"
                  : Number(info?.doc_type) === 4
                    ? "spreadsheet"
                    : "doc",
              summary: summarizeDocInfo(info),
              raw: result.raw,
            });
          }
          case "share": {
            const result = await docClient.shareDoc({
              agent: account,
              docId: params.docId as string,
            });
            return buildDocToolResult({
              ok: true,
              action: "share",
              accountId: account.accountId,
              canonicalDocId: params.docId,
              docId: params.docId,
              url: result.shareUrl || undefined,
              summary: result.shareUrl
                ? `文档分享链接已获取（docId: ${readString(params.docId)}）`
                : `文档分享接口调用成功（docId: ${readString(params.docId)}）`,
              usageHint: buildDocIdUsageHint(params.docId as string | undefined) || undefined,
              raw: result.raw,
            });
          }
          case "get_auth": {
            const result = await docClient.getDocAuth({
              agent: account,
              docId: params.docId as string,
            });
            const diagnosis = buildDocAuthDiagnosis(result, toolContext?.senderId);
            return buildDocToolResult({
              ok: true,
              action: "get_auth",
              accountId: account.accountId,
              canonicalDocId: params.docId,
              docId: params.docId,
              summary: summarizeDocAuth(result),
              diagnosis,
              raw: result.raw,
            });
          }
          case "diagnose_auth": {
            const result = await docClient.getDocAuth({
              agent: account,
              docId: params.docId as string,
            });
            const diagnosis = buildDocAuthDiagnosis(result, toolContext?.senderId);
            return buildDocToolResult({
              ok: true,
              action: "diagnose_auth",
              accountId: account.accountId,
              canonicalDocId: params.docId,
              docId: params.docId,
              summary: summarizeDocAuthDiagnosis(diagnosis),
              diagnosis,
              raw: result.raw,
            });
          }
          case "validate_share_link": {
            const result = await inspectWecomShareLink({
              shareUrl: params.shareUrl as string,
            });
            return buildDocToolResult({
              ok: true,
              action: "validate_share_link",
              accountId: account.accountId,
              url: result.diagnosis.finalUrl || params.shareUrl,
              summary: summarizeShareLinkDiagnosis(result.diagnosis),
              diagnosis: result.diagnosis,
              raw: result.raw,
            });
          }
          case "delete": {
            const result = await docClient.deleteDoc({
              agent: account,
              docId: params.docId as string | undefined,
              formId: params.formId as string | undefined,
            });
            return buildDocToolResult({
              ok: true,
              action: "delete",
              accountId: account.accountId,
              docId: result.docId || undefined,
              formId: result.formId || undefined,
              summary: result.formId ? "收集表已删除" : "文档已删除",
              raw: result.raw,
            });
          }
          case "set_join_rule": {
            const result = await docClient.setDocJoinRule({
              agent: account,
              docId: params.docId as string,
              request: params.request as Record<string, unknown>,
            });
            return buildDocToolResult({
              ok: true,
              action: "set_join_rule",
              accountId: account.accountId,
              docId: result.docId,
              summary: "文档查看规则已更新",
              raw: result.raw,
            });
          }
          case "set_member_auth": {
            const result = await docClient.setDocMemberAuth({
              agent: account,
              docId: params.docId as string,
              request: params.request as Record<string, unknown>,
            });
            return buildDocToolResult({
              ok: true,
              action: "set_member_auth",
              accountId: account.accountId,
              docId: result.docId,
              summary: "文档通知范围及成员权限已更新",
              raw: result.raw,
            });
          }
          case "grant_access": {
            const result = await docClient.grantDocAccess({
              agent: account,
              docId: params.docId as string,
              viewers: params.viewers,
              collaborators: params.collaborators,
              removeViewers: params.removeViewers,
              removeCollaborators: params.removeCollaborators,
              authLevel: params.auth as number | undefined,
            });
            return buildDocToolResult({
              ok: true,
              action: "grant_access",
              accountId: account.accountId,
              docId: result.docId,
              summary: summarizeDocAccess(result),
              raw: result.raw,
            });
          }
          case "add_collaborators": {
            const result = await docClient.addDocCollaborators({
              agent: account,
              docId: params.docId as string,
              collaborators: params.collaborators,
              auth: params.auth as number | undefined,
            });
            return buildDocToolResult({
              ok: true,
              action: "add_collaborators",
              accountId: account.accountId,
              docId: result.docId,
              summary: `协作者已添加：${result.addedCollaboratorCount ?? 0}`,
              raw: result.raw,
            });
          }
          case "get_content": {
            const result = await docClient.getDocContent({
              agent: account,
              docId: params.docId as string,
            });
            return buildDocToolResult({
              ok: true,
              action: "get_content",
              accountId: account.accountId,
              docId: params.docId,
              summary: "文档内容已获取",
              raw: result.raw,
            });
          }
          case "update_content": {
            const batchMode = params.batchMode === true;

            const result = await docClient.updateDocContent({
              agent: account,
              docId: params.docId as string,
              requests: params.requests as UpdateRequest[],
              version: params.version as number | undefined,
              batchMode: batchMode,
            });

            return buildDocToolResult({
              ok: true,
              action: "update_content",
              accountId: account.accountId,
              docId: params.docId,
              summary: `文档内容已更新（${batchMode ? "批量" : "顺序"}模式）`,
              raw: result.raw,
            });
          }
          case "set_safety_setting": {
            const result = await docClient.setDocSafetySetting({
              agent: account,
              docId: params.docId as string,
              request: params.request as Record<string, unknown>,
            });
            return buildDocToolResult({
              ok: true,
              action: "set_safety_setting",
              accountId: account.accountId,
              docId: result.docId,
              summary: "文档安全设置已更新",
              raw: result.raw,
            });
          }
          case "get_doc_security_setting": {
            const result = await docClient.getDocAuth({
              agent: account,
              docId: params.docId as string,
            });
            return buildDocToolResult({
              ok: true,
              action: "get_doc_security_setting",
              accountId: account.accountId,
              docId: params.docId,
              summary: "文档安全设置已获取",
              details: result.secureSetting,
              raw: result.raw,
            });
          }
          case "mod_doc_security_setting": {
            // Alias to setDocSafetySetting logic
            const result = await docClient.setDocSafetySetting({
              agent: account,
              docId: params.docId as string,
              request: params.setting as Record<string, unknown>,
            });
            return buildDocToolResult({
              ok: true,
              action: "mod_doc_security_setting",
              accountId: account.accountId,
              docId: result.docId,
              summary: "文档安全设置已更新",
              raw: result.raw,
            });
          }
          case "mod_doc_member_notified_scope": {
            const result = await docClient.modDocMemberNotifiedScope({
              agent: account,
              docId: params.docId as string,
              notified_scope_type: params.notified_scope_type as number,
              notified_member_list: params.notified_member_list as
                | Array<Record<string, unknown>>
                | undefined,
            });
            return buildDocToolResult({
              ok: true,
              action: "mod_doc_member_notified_scope",
              accountId: account.accountId,
              docId: params.docId,
              summary: "文档成员通知范围已更新",
              raw: result,
            });
          }
          case "create_collect": {
            // 创建收集表（表单）
            // 参考 API 规范文档：E8_AF_B7_E4_B8_A5_E6_A0_BC_E6_8C_89_E7_85_A7_E4_BB_A5_E4_B8_---099c30ec-70bd-4e5b-ae03-212de0226a25.docx
            try {
              const result = await docClient.createCollect({
                agent: account,
                formInfo: params.formInfo as Record<string, unknown> | undefined,
                form_info: params.form_info as Record<string, unknown> | undefined,
                request: params.request as Record<string, unknown> | undefined,
                spaceId: params.spaceId as string | undefined,
                fatherId: params.fatherId as string | undefined,
              });
              const title = readString(result.title);
              return buildDocToolResult({
                ok: true,
                action: "create_collect",
                accountId: account.accountId,
                formId: result.formId,
                title: title || undefined,
                summary: title
                  ? `已创建收集表"${title}"（formId: ${result.formId}）`
                  : `已创建收集表（formId: ${result.formId}）`,
                raw: result.raw,
              });
            } catch (err) {
              // 提供更详细的错误提示
              const errorMsg = err instanceof Error ? err.message : String(err);
              const hint = `
创建收集表失败。请检查以下必填项：
- form_title: 收集表标题（必填）
- form_question.items: 问题数组（必填且至少 1 个，≤200 个）；不支持仅传 docName 创建收集表
- 每个问题必须包含：question_id, title, pos, reply_type, must_reply
- 单选/多选/下拉列表必须提供 option_item 数组
- reply_type 对照表：1 文本，2 单选，3 多选，5 位置，9 图片，10 文件，11 日期，14 时间，15 下拉列表，16 体温，17 签名，18 部门，19 成员，22 时长

错误详情：${errorMsg}`;
              return buildDocToolResult({
                ok: false,
                action: "create_collect",
                accountId: account.accountId,
                error: errorMsg,
                summary: "创建收集表失败",
                hint: hint.trim(),
                raw: {},
              });
            }
          }
          case "modify_collect": {
            const result = await docClient.modifyCollect({
              agent: account,
              oper: params.oper as string,
              formId: params.formId as string,
              formInfo: params.formInfo as Record<string, unknown>,
            });
            const title = readString(result.title);
            return buildDocToolResult({
              ok: true,
              action: "modify_collect",
              accountId: account.accountId,
              formId: result.formId,
              title: title || undefined,
              summary: title
                ? `收集表已更新（${result.oper}）："${title}"`
                : `收集表已更新（${result.oper}）`,
              raw: result.raw,
            });
          }
          case "get_form_info": {
            const result = await docClient.getFormInfo({
              agent: account,
              formId: params.formId as string,
            });
            return buildDocToolResult({
              ok: true,
              action: "get_form_info",
              accountId: account.accountId,
              formId: params.formId,
              title: readString(result.formInfo?.form_title) || undefined,
              summary: summarizeFormInfo(result),
              raw: result.raw,
            });
          }
          case "get_form_answer": {
            const result = await docClient.getFormAnswer({
              agent: account,
              repeatedId: params.repeatedId as string,
              answerIds: params.answerIds as unknown[] | undefined,
            });
            return buildDocToolResult({
              ok: true,
              action: "get_form_answer",
              accountId: account.accountId,
              repeatedId: params.repeatedId,
              summary: summarizeFormAnswer(result),
              raw: result.raw,
            });
          }
          case "get_form_statistic": {
            const result = await docClient.getFormStatistic({
              agent: account,
              formId: params.formId as string | undefined,
              requests: params.requests as unknown[],
            });
            return buildDocToolResult({
              ok: true,
              action: "get_form_statistic",
              accountId: account.accountId,
              summary: summarizeFormStatistic(result),
              raw: result.raw,
            });
          }
          case "get_sheet_properties": {
            const result = await docClient.getSheetProperties({
              agent: account,
              docId: params.docId as string,
            });
            return buildDocToolResult({
              ok: true,
              action: "get_sheet_properties",
              accountId: account.accountId,
              docId: params.docId,
              summary: summarizeSheetProperties(result),
              raw: result.raw,
            });
          }
          case "edit_sheet_data": {
            const result = await docClient.editSheetData({
              agent: account,
              docId: params.docId as string,
              sheetId: params.sheetId as string,
              startRow: (params.startRow ?? 0) as number,
              startColumn: (params.startColumn ?? 0) as number,
              gridData: params.gridData as Record<string, unknown> | undefined,
            });
            return buildDocToolResult({
              ok: true,
              action: "edit_sheet_data",
              accountId: account.accountId,
              docId: result.docId,
              summary: "在线表格数据已编辑",
              raw: result.raw,
            });
          }
          case "get_sheet_data": {
            const result = await docClient.getSheetData({
              agent: account,
              docId: params.docId as string,
              sheetId: params.sheetId as string,
              range: params.range as string,
            });
            return buildDocToolResult({
              ok: true,
              action: "get_sheet_data",
              accountId: account.accountId,
              docId: params.docId,
              summary: "在线表格数据已读取",
              data: result.data,
              raw: result.raw,
            });
          }
          case "modify_sheet_properties": {
            const result = await docClient.modifySheetProperties({
              agent: account,
              docId: params.docId as string,
              requests: params.requests as unknown[],
            });
            return buildDocToolResult({
              ok: true,
              action: "modify_sheet_properties",
              accountId: account.accountId,
              docId: result.docId,
              summary: "在线表格属性已修改",
              raw: result.raw,
            });
          }
          case "smartsheet_add_sheet": {
            const result = await docClient.smartTableAddSheet({
              agent: account,
              docId: params.docId as string,
              title: params.title as string,
              index: params.index as number | undefined,
              properties: params.properties as Record<string, unknown> | undefined,
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格子表已添加",
              raw: result.raw,
            });
          }
          case "smartsheet_del_sheet": {
            const result = await docClient.smartTableDelSheet({
              agent: account,
              docId: params.docId as string,
              sheetId: params.sheetId as string,
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格子表已删除",
              raw: result.raw,
            });
          }
          case "smartsheet_update_sheet": {
            const result = await docClient.smartTableUpdateSheet({
              agent: account,
              docId: params.docId as string,
              sheetId: params.sheetId as string,
              title: params.title as string,
              properties: params.properties as Record<string, unknown> | undefined,
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格子表已更新",
              raw: result.raw,
            });
          }
          case "smartsheet_add_view": {
            const result = await docClient.smartTableAddView({
              agent: account,
              docId: params.docId as string,
              sheetId: params.sheetId as string,
              view_title: params.view_title as string,
              view_type: params.view_type as string,
              property_gantt: params.property_gantt as Record<string, unknown> | undefined,
              property_calendar: params.property_calendar as Record<string, unknown> | undefined,
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格视图已添加",
              raw: result.raw,
            });
          }
          case "smartsheet_del_view": {
            const result = await docClient.smartTableDelView({
              agent: account,
              docId: params.docId as string,
              sheetId: params.sheetId as string,
              view_ids: params.view_ids as string[],
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格视图已删除",
              raw: result.raw,
            });
          }
          case "smartsheet_get_views": {
            const result = await docClient.smartTableOperate({
              agent: account,
              docId: params.docId as string,
              operation: "get_views",
              bodyData: { sheet_id: params.sheetId },
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格视图列表已获取",
              raw: result.raw,
            });
          }
          case "smartsheet_add_fields": {
            const result = await docClient.smartTableAddFields({
              agent: account,
              docId: params.docId as string,
              sheetId: params.sheetId as string,
              fields: params.fields as Array<Record<string, unknown>>,
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格字段已添加",
              raw: result.raw,
            });
          }
          case "smartsheet_del_fields": {
            const result = await docClient.smartTableDelFields({
              agent: account,
              docId: params.docId as string,
              sheetId: params.sheetId as string,
              field_ids: params.field_ids as string[],
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格字段已删除",
              raw: result.raw,
            });
          }
          case "smartsheet_update_fields": {
            const result = await docClient.smartTableUpdateFields({
              agent: account,
              docId: params.docId as string,
              sheetId: params.sheetId as string,
              fields: params.fields as Array<Record<string, unknown>>,
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格字段已更新",
              raw: result.raw,
            });
          }
          case "smartsheet_update_view": {
            const result = await docClient.smartTableUpdateView({
              agent: account,
              docId: params.docId as string,
              sheetId: params.sheetId as string,
              view_id: params.view_id as string,
              view_title: params.view_title as string | undefined,
              property: params.property as Record<string, unknown> | undefined,
              property_gantt: params.property_gantt as Record<string, unknown> | undefined,
              property_calendar: params.property_calendar as Record<string, unknown> | undefined,
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格视图已更新",
              raw: result.raw,
            });
          }
          case "smartsheet_get_fields": {
            const result = await docClient.smartTableOperate({
              agent: account,
              docId: params.docId as string,
              operation: "get_fields",
              bodyData: { sheet_id: params.sheetId, view_id: params.view_id },
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格字段列表已获取",
              raw: result.raw,
            });
          }
          case "smartsheet_add_group": {
            const result = await docClient.smartTableAddGroup({
              agent: account,
              docId: params.docId as string,
              sheetId: params.sheetId as string,
              name: params.name as string,
              children: params.children as unknown[] | undefined,
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格编组已添加",
              raw: result.raw,
            });
          }
          case "smartsheet_del_group": {
            const result = await docClient.smartTableDelGroup({
              agent: account,
              docId: params.docId as string,
              sheetId: params.sheetId as string,
              field_group_id: params.field_group_id as string,
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格编组已删除",
              raw: result.raw,
            });
          }
          case "smartsheet_update_group": {
            const result = await docClient.smartTableUpdateGroup({
              agent: account,
              docId: params.docId as string,
              sheetId: params.sheetId as string,
              field_group_id: params.field_group_id as string,
              name: params.name as string | undefined,
              children: params.children as unknown[] | undefined,
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格编组已更新",
              raw: result.raw,
            });
          }
          case "smartsheet_get_groups": {
            const result = await docClient.smartTableGetGroups({
              agent: account,
              docId: params.docId as string,
              sheetId: params.sheetId as string,
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格编组列表已获取",
              raw: result.raw,
            });
          }
          case "smartsheet_add_external_records": {
            await docClient.smartTableAddExternalRecords({
              agent: account,
              docId: params.docId as string,
              sheetId: params.sheetId as string,
              records: params.records as Array<Record<string, unknown>>,
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格外部记录已添加",
              raw: {},
            });
          }
          case "smartsheet_update_external_records": {
            await docClient.smartTableUpdateExternalRecords({
              agent: account,
              docId: params.docId as string,
              sheetId: params.sheetId as string,
              records: params.records as Array<Record<string, unknown>>,
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格外部记录已更新",
              raw: {},
            });
          }
          case "smartsheet_add_records": {
            const result = await docClient.smartTableAddRecords({
              agent: account,
              docId: params.docId as string,
              sheetId: params.sheetId as string,
              keyType: params.key_type as string | undefined,
              records: params.records as Array<Record<string, unknown>>,
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格记录已添加",
              raw: result.raw,
            });
          }
          case "smartsheet_update_records": {
            const result = await docClient.smartTableUpdateRecords({
              agent: account,
              docId: params.docId as string,
              sheetId: params.sheetId as string,
              keyType: params.key_type as string | undefined,
              records: params.records as Array<Record<string, unknown>>,
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格记录已更新",
              raw: result.raw,
            });
          }
          case "smartsheet_del_records": {
            const result = await docClient.smartTableDelRecords({
              agent: account,
              docId: params.docId as string,
              sheetId: params.sheetId as string,
              record_ids: params.record_ids as string[],
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格记录已删除",
              raw: result.raw,
            });
          }
          case "smartsheet_get_records": {
            const result = await docClient.smartTableGetRecords({
              agent: account,
              docId: params.docId as string,
              sheetId: params.sheetId as string,
              view_id: params.view_id as string | undefined,
              record_ids: params.record_ids as string[] | undefined,
              field_titles: params.field_titles as string[] | undefined,
              field_ids: params.field_ids as string[] | undefined,
              sort: params.sort as unknown[] | undefined,
              filter_spec: params.filter_spec as Record<string, unknown> | undefined,
              keyType: params.key_type as string | undefined,
              offset: params.offset as number | undefined,
              limit: params.limit as number | undefined,
              ver: params.ver as number | undefined,
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格记录列表已获取",
              raw: result.raw,
            });
          }
          case "smartsheet_get_sheets": {
            const result = await docClient.smartTableGetSheets({
              agent: account,
              docId: params.docId as string,
            });
            return buildDocToolResult({
              ok: true,
              action: "smartsheet_get_sheets",
              accountId: account.accountId,
              docId: params.docId,
              summary: `智能表格子表列表已获取：${result.sheets.length} 个`,
              raw: result.raw,
            });
          }
          case "smartsheet_get_sheet_priv": {
            const result = await docClient.smartTableGetSheetPriv({
              agent: account,
              docId: params.docId as string,
              type: params.type as number | undefined,
              rule_id_list: params.rule_id_list as number[] | undefined,
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格子表权限已获取",
              raw: result.raw,
              ruleList: result.ruleList,
            });
          }
          case "smartsheet_update_sheet_priv": {
            const result = await docClient.smartTableUpdateSheetPriv({
              agent: account,
              docId: params.docId as string,
              type: params.type as number,
              rule_id: params.rule_id as number | undefined,
              name: params.name as string | undefined,
              priv_list: params.priv_list as Array<Record<string, unknown>>,
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格子表权限已更新",
              raw: result.raw,
            });
          }
          case "smartsheet_create_rule": {
            const result = await docClient.smartTableCreateRule({
              agent: account,
              docId: params.docId as string,
              name: params.name as string | undefined,
              rule_name: params.rule_name as string | undefined,
              ruleName: params.ruleName as string | undefined,
              type: params.type as number | undefined,
              priv_list: params.priv_list as Array<Record<string, unknown>> | undefined,
              member_range: params.member_range as Record<string, unknown> | undefined,
              add_member_range: params.add_member_range as Record<string, unknown> | undefined,
              del_member_range: params.del_member_range as Record<string, unknown> | undefined,
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: `智能表格成员额外权限规则已创建 (rule_id: ${readString(result.rule_id) || "unknown"})`,
              raw: result.raw,
            });
          }
          case "smartsheet_mod_rule_member": {
            const result = await docClient.smartTableModRuleMember({
              agent: account,
              docId: params.docId as string,
              rule_id: params.rule_id as number,
              add_member_range: params.add_member_range as Record<string, unknown> | undefined,
              del_member_range: params.del_member_range as Record<string, unknown> | undefined,
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格成员额外权限成员已更新",
              raw: result.raw,
            });
          }
          case "smartsheet_delete_rule": {
            const result = await docClient.smartTableDeleteRule({
              agent: account,
              docId: params.docId as string,
              rule_id_list: params.rule_id_list as number[],
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              docId: params.docId,
              summary: "智能表格成员额外权限规则已删除",
              raw: result.raw,
            });
          }
          case "doc_assign_advanced_account": {
            const result = await docClient.assignDocAdvancedAccount({
              agent: account,
              userid_list: params.userid_list as string[],
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: summarizeAdvancedAccount(
                result.raw as Record<string, unknown> | undefined,
                "assign",
              ),
              raw: result.raw,
            });
          }
          case "doc_cancel_advanced_account": {
            const result = await docClient.cancelDocAdvancedAccount({
              agent: account,
              userid_list: params.userid_list as string[],
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: summarizeAdvancedAccount(
                result.raw as Record<string, unknown> | undefined,
                "cancel",
              ),
              raw: result.raw,
            });
          }
          case "doc_get_advanced_account_list": {
            const result = await docClient.getDocAdvancedAccountList({
              agent: account,
              offset: params.offset as number | undefined,
              limit: params.limit as number | undefined,
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: summarizeAdvancedAccount(result, "list"),
              raw: result.raw,
            });
          }
          case "upload_doc_image": {
            const filePath = params.file_path as string;
            if (!fs.existsSync(filePath)) {
              throw new Error(`File not found: ${filePath}`);
            }
            const fileContent = fs.readFileSync(filePath);
            const base64Content = fileContent.toString("base64");

            const result = await docClient.uploadDocImage({
              agent: account,
              docId: params.docId as string,
              base64_content: base64Content,
            });
            return buildDocToolResult({
              ok: true,
              action,
              accountId: account.accountId,
              summary: "图片上传成功",
              details: {
                url: result.url,
                width: result.width,
                height: result.height,
                size: result.size,
              },
              raw: result.raw,
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
