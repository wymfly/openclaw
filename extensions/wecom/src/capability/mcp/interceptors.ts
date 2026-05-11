import * as fs from "node:fs/promises";
import * as path from "node:path";
import { detectMime } from "openclaw/plugin-sdk/media-mime";
import { getWecomRuntime } from "../../runtime.js";
import { sendJsonRpc, type SendJsonRpcOptions } from "./transport.js";

const UPLOAD_TIMEOUT_MS = 60_000;
const MEDIA_DOWNLOAD_TIMEOUT_MS = 120_000;
const INTERCEPTOR_TIMEOUT_MS = 120_000;
const MAX_SINGLE_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_FILE_SIZE = 20 * 1024 * 1024;
const INBOUND_MAX_BYTES = 20 * 1024 * 1024;

export interface WecomMcpCallContext {
  accountId: string;
  category: string;
  method: string;
  args: Record<string, unknown>;
}

export interface ResolvedMcpBeforeCall {
  args?: Record<string, unknown>;
  options?: SendJsonRpcOptions;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return "";
  }
  const trimmed = String(value).trim();
  return trimmed || "";
}

function readOptionalFiniteNumber(value: unknown): number | undefined {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
}

function normalizeCollectFormQuestion(
  value: unknown,
  fallbackItems: unknown[] = [],
): Record<string, unknown> {
  const formQuestion = isRecord(value) ? value : {};
  const items = Array.isArray(formQuestion.items) ? formQuestion.items : [];
  return {
    ...formQuestion,
    items: items.length > 0 ? items : fallbackItems,
  };
}

function normalizeSmartTableSheetPrivValue(value: unknown): unknown {
  if (isRecord(value)) {
    return normalizeSmartTableSheetPrivValue(
      value.priv || value.value || value.type || value.auth || value.permission || value.name,
    );
  }
  const numberValue = readOptionalFiniteNumber(value);
  if (numberValue !== undefined) {
    return numberValue;
  }
  const normalized = readString(value).toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (
    ["1", "all", "full", "all_priv", "all_access", "sheet_priv_all", "全部权限"].includes(
      normalized,
    )
  ) {
    return 1;
  }
  if (
    ["2", "edit", "editable", "write", "readwrite", "read_write", "can_edit", "可编辑"].includes(
      normalized,
    )
  ) {
    return 2;
  }
  if (
    ["3", "view", "readonly", "read_only", "view_only", "read", "can_view", "仅浏览"].includes(
      normalized,
    )
  ) {
    return 3;
  }
  if (["4", "none", "no_access", "deny", "disabled", "无权限"].includes(normalized)) {
    return 4;
  }
  return value;
}

function normalizeSmartTablePrivList(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }
  return value.map((item) => {
    if (!isRecord(item)) {
      return item;
    }
    return {
      ...item,
      priv: normalizeSmartTableSheetPrivValue(item.priv),
    };
  });
}

function normalizeSmartsheetPermissionArgs(
  ctx: WecomMcpCallContext,
): Record<string, unknown> | undefined {
  if (
    ctx.category !== "doc" ||
    (ctx.method !== "smartsheet_create_rule" && ctx.method !== "smartsheet_update_sheet_priv") ||
    !Array.isArray(ctx.args.priv_list)
  ) {
    return undefined;
  }
  const clonedArgs = structuredClone(ctx.args);
  clonedArgs.priv_list = normalizeSmartTablePrivList(clonedArgs.priv_list);
  return clonedArgs;
}

function normalizeCreateCollectArgs(ctx: WecomMcpCallContext): Record<string, unknown> | undefined {
  if (ctx.category !== "doc" || ctx.method !== "create_collect") {
    return undefined;
  }
  const clonedArgs = structuredClone(ctx.args);
  const hasFormInfo = isRecord(clonedArgs.form_info) || isRecord(clonedArgs.formInfo);
  const formInfo = isRecord(clonedArgs.form_info)
    ? clonedArgs.form_info
    : isRecord(clonedArgs.formInfo)
      ? clonedArgs.formInfo
      : {};
  const title = readString(
    formInfo.form_title || formInfo.formTitle || clonedArgs.form_title || clonedArgs.formTitle,
  );
  const fallbackItems = Array.isArray(clonedArgs.items)
    ? clonedArgs.items
    : Array.isArray(clonedArgs.questions)
      ? clonedArgs.questions
      : [];
  if (!title || (!hasFormInfo && fallbackItems.length === 0)) {
    return undefined;
  }
  clonedArgs.form_info = {
    ...formInfo,
    form_title: readString(formInfo.form_title) || title,
    form_question: normalizeCollectFormQuestion(formInfo.form_question, fallbackItems),
    form_setting: isRecord(formInfo.form_setting) ? formInfo.form_setting : {},
  };
  delete clonedArgs.formInfo;
  delete clonedArgs.formTitle;
  delete clonedArgs.form_title;
  delete clonedArgs.docName;
  delete clonedArgs.items;
  delete clonedArgs.questions;
  return clonedArgs;
}

interface ImageUploadTask {
  kind: "image";
  filePath: string;
  title?: string;
  cellValue: Record<string, unknown>;
}

interface FileUploadTask {
  kind: "file";
  filePath: string;
  cellValue: Record<string, unknown>;
}

type UploadTask = ImageUploadTask | FileUploadTask;

function mergeTimeout(
  current: SendJsonRpcOptions | undefined,
  timeoutMs: number | undefined,
): SendJsonRpcOptions | undefined {
  if (timeoutMs === undefined) {
    return current;
  }
  return {
    timeoutMs: Math.max(current?.timeoutMs ?? 0, timeoutMs),
  };
}

function parseToolTextJson(result: unknown, label: string): Record<string, unknown> {
  const content = (result as { content?: Array<{ type?: string; text?: string }> } | undefined)
    ?.content;
  if (!Array.isArray(content)) {
    throw new Error(`${label} response missing content`);
  }
  const textItem = content.find((item) => item.type === "text" && typeof item.text === "string");
  if (!textItem?.text) {
    throw new Error(`${label} response missing text content`);
  }
  try {
    return JSON.parse(textItem.text) as Record<string, unknown>;
  } catch {
    throw new Error(`${label} response text is not JSON`);
  }
}

function formatUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }
  if (value === undefined) {
    return "unknown";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "unknown";
  }
}

function tryParseToolTextJson(result: unknown): Record<string, unknown> | undefined {
  const content = (result as { content?: Array<{ type?: string; text?: string }> } | undefined)
    ?.content;
  if (!Array.isArray(content)) {
    return undefined;
  }
  const textItem = content.find((item) => item.type === "text" && typeof item.text === "string");
  if (!textItem?.text) {
    return undefined;
  }
  try {
    return JSON.parse(textItem.text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function collectUploadTasks(records: Record<string, unknown>[]): UploadTask[] {
  const tasks: UploadTask[] = [];
  for (const record of records) {
    const values = record.values;
    if (!values || typeof values !== "object" || Array.isArray(values)) {
      continue;
    }
    for (const fieldValue of Object.values(values)) {
      if (!Array.isArray(fieldValue)) {
        continue;
      }
      for (const cellValue of fieldValue) {
        if (!cellValue || typeof cellValue !== "object" || Array.isArray(cellValue)) {
          continue;
        }
        const cell = cellValue as Record<string, unknown>;
        if (typeof cell.image_path === "string" && cell.image_path) {
          tasks.push({
            kind: "image",
            filePath: cell.image_path,
            title: typeof cell.title === "string" ? cell.title : undefined,
            cellValue: cell,
          });
          continue;
        }
        if (typeof cell.file_path === "string" && cell.file_path) {
          tasks.push({
            kind: "file",
            filePath: cell.file_path,
            cellValue: cell,
          });
        }
      }
    }
  }
  return tasks;
}

async function validateUploadTasks(tasks: UploadTask[]): Promise<void> {
  let totalSize = 0;
  for (const task of tasks) {
    const stat = await fs.stat(task.filePath);
    if (!stat.isFile()) {
      throw new Error(`smartsheet upload path is not a file: ${task.filePath}`);
    }
    if (stat.size > MAX_SINGLE_FILE_SIZE) {
      throw new Error(`smartsheet upload file exceeds 10MB: ${task.filePath}`);
    }
    totalSize += stat.size;
    if (totalSize > MAX_TOTAL_FILE_SIZE) {
      throw new Error("smartsheet upload files exceed 20MB total");
    }
  }
}

function extractDocLocator(args: Record<string, unknown>): Record<string, unknown> {
  if (typeof args.docid === "string" && args.docid) {
    return { docid: args.docid };
  }
  if (typeof args.url === "string" && args.url) {
    return { url: args.url };
  }
  throw new Error("smartsheet image upload requires docid or url");
}

async function uploadImageTask(
  ctx: WecomMcpCallContext,
  task: ImageUploadTask,
  docLocator: Record<string, unknown>,
): Promise<void> {
  const buffer = await fs.readFile(task.filePath);
  const result = await sendJsonRpc(
    ctx.accountId,
    "doc",
    "tools/call",
    {
      name: "upload_doc_image",
      arguments: {
        ...docLocator,
        base64_content: buffer.toString("base64"),
      },
    },
    { timeoutMs: UPLOAD_TIMEOUT_MS },
  );
  const data = parseToolTextJson(result, "upload_doc_image");
  if (data.errcode !== 0) {
    throw new Error(
      `upload_doc_image failed: errcode=${formatUnknown(data.errcode)} errmsg=${formatUnknown(data.errmsg)}`,
    );
  }
  if (typeof data.url !== "string" || !data.url) {
    throw new Error("upload_doc_image response missing url");
  }
  task.cellValue.image_url = data.url;
  task.cellValue.title = task.title || path.basename(task.filePath);
  delete task.cellValue.image_path;
}

async function uploadFileTask(ctx: WecomMcpCallContext, task: FileUploadTask): Promise<void> {
  const buffer = await fs.readFile(task.filePath);
  const result = await sendJsonRpc(
    ctx.accountId,
    "doc",
    "tools/call",
    {
      name: "upload_doc_file",
      arguments: {
        file_name: path.basename(task.filePath),
        file_base64_content: buffer.toString("base64"),
      },
    },
    { timeoutMs: UPLOAD_TIMEOUT_MS },
  );
  const data = parseToolTextJson(result, "upload_doc_file");
  if (data.errcode !== 0) {
    throw new Error(
      `upload_doc_file failed: errcode=${formatUnknown(data.errcode)} errmsg=${formatUnknown(data.errmsg)}`,
    );
  }
  if (typeof data.fileid !== "string" || !data.fileid) {
    throw new Error("upload_doc_file response missing fileid");
  }
  task.cellValue.file_id = data.fileid;
  delete task.cellValue.file_path;
}

async function resolveSmartsheetUploads(
  ctx: WecomMcpCallContext,
): Promise<ResolvedMcpBeforeCall | undefined> {
  if (
    ctx.category !== "doc" ||
    (ctx.method !== "smartsheet_add_records" && ctx.method !== "smartsheet_update_records")
  ) {
    return undefined;
  }
  const clonedArgs = structuredClone(ctx.args);
  const records = clonedArgs.records;
  if (!Array.isArray(records) || records.length === 0) {
    return undefined;
  }
  const tasks = collectUploadTasks(records as Record<string, unknown>[]);
  if (tasks.length === 0) {
    return undefined;
  }
  await validateUploadTasks(tasks);
  const docLocator = tasks.some((task) => task.kind === "image")
    ? extractDocLocator(clonedArgs)
    : {};
  for (const task of tasks) {
    if (task.kind === "image") {
      await uploadImageTask(ctx, task, docLocator);
    } else {
      await uploadFileTask(ctx, task);
    }
  }
  return {
    args: clonedArgs,
    options: { timeoutMs: INTERCEPTOR_TIMEOUT_MS },
  };
}

async function resolveSmartpageCreate(
  ctx: WecomMcpCallContext,
): Promise<ResolvedMcpBeforeCall | undefined> {
  if (ctx.category !== "doc" || ctx.method !== "smartpage_create") {
    return undefined;
  }
  const pages = ctx.args.pages;
  if (!Array.isArray(pages) || pages.length === 0) {
    return undefined;
  }
  const hasFilePath = pages.some(
    (page) =>
      page &&
      typeof page === "object" &&
      !Array.isArray(page) &&
      typeof (page as Record<string, unknown>).page_filepath === "string",
  );
  if (!hasFilePath) {
    return undefined;
  }
  const clonedArgs = structuredClone(ctx.args);
  const clonedPages = clonedArgs.pages as Record<string, unknown>[];
  let totalSize = 0;
  const resolvedPages = await Promise.all(
    clonedPages.map(async (page) => {
      const filePath = page.page_filepath;
      if (typeof filePath !== "string" || !filePath) {
        return page;
      }
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) {
        throw new Error(`smartpage_create page_filepath is not a file: ${filePath}`);
      }
      if (stat.size > MAX_SINGLE_FILE_SIZE) {
        throw new Error(`smartpage_create page_filepath exceeds 10MB: ${filePath}`);
      }
      totalSize += stat.size;
      if (totalSize > MAX_TOTAL_FILE_SIZE) {
        throw new Error("smartpage_create page files exceed 20MB total");
      }
      const content = await fs.readFile(filePath, "utf8");
      const { page_filepath: _ignored, ...rest } = page;
      return {
        ...rest,
        page_content: content,
      };
    }),
  );
  return {
    args: {
      ...clonedArgs,
      pages: resolvedPages,
    },
  };
}

export async function resolveMcpBeforeCall(
  ctx: WecomMcpCallContext,
): Promise<ResolvedMcpBeforeCall> {
  let args: Record<string, unknown> | undefined;
  let options: SendJsonRpcOptions | undefined;

  if (ctx.method === "get_msg_media") {
    options = mergeTimeout(options, MEDIA_DOWNLOAD_TIMEOUT_MS);
  }

  args = normalizeSmartsheetPermissionArgs(ctx) ?? normalizeCreateCollectArgs(ctx);

  const smartpage = await resolveSmartpageCreate({ ...ctx, args: args ?? ctx.args });
  if (smartpage?.args) {
    args = smartpage.args;
  }
  if (smartpage?.options?.timeoutMs) {
    options = mergeTimeout(options, smartpage.options.timeoutMs);
  }

  const upload = await resolveSmartsheetUploads({ ...ctx, args: args ?? ctx.args });
  if (upload?.args) {
    args = upload.args;
  }
  if (upload?.options?.timeoutMs) {
    options = mergeTimeout(options, upload.options.timeoutMs);
  }

  return {
    ...(args ? { args } : {}),
    ...(options ? { options } : {}),
  };
}

async function interceptGetMsgMedia(result: unknown): Promise<unknown> {
  const data = tryParseToolTextJson(result);
  if (!data || data.errcode !== 0) {
    return result;
  }
  const mediaItem = data.media_item;
  if (!mediaItem || typeof mediaItem !== "object" || Array.isArray(mediaItem)) {
    return result;
  }
  const item = mediaItem as Record<string, unknown>;
  if (typeof item.base64_data !== "string" || !item.base64_data) {
    return result;
  }
  const buffer = Buffer.from(item.base64_data, "base64");
  const name = typeof item.name === "string" ? item.name : undefined;
  const contentType = (await detectMime({ buffer, filePath: name })) ?? "application/octet-stream";
  const saved = await getWecomRuntime().channel.media.saveMediaBuffer(
    buffer,
    contentType,
    "inbound",
    INBOUND_MAX_BYTES,
    name,
  );
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          errcode: 0,
          errmsg: data.errmsg ?? "ok",
          media_item: {
            media_id: item.media_id,
            name: name ?? path.basename(saved.path),
            type: item.type,
            local_path: saved.path,
            size: buffer.length,
            content_type: saved.contentType,
          },
        }),
      },
    ],
  };
}

async function interceptSmartpageExport(result: unknown): Promise<unknown> {
  const data = tryParseToolTextJson(result);
  if (!data || data.errcode !== 0 || data.task_done !== true || typeof data.content !== "string") {
    return result;
  }
  const buffer = Buffer.from(data.content, "utf8");
  const saved = await getWecomRuntime().channel.media.saveMediaBuffer(
    buffer,
    "text/markdown",
    "inbound",
    undefined,
    "smartpage_export.md",
  );
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          errcode: data.errcode,
          errmsg: data.errmsg ?? "ok",
          task_done: true,
          content_path: saved.path,
        }),
      },
    ],
  };
}

export async function runMcpAfterCall(ctx: WecomMcpCallContext, result: unknown): Promise<unknown> {
  if (ctx.method === "get_msg_media") {
    return interceptGetMsgMedia(result);
  }
  if (ctx.category === "doc" && ctx.method === "smartpage_get_export_result") {
    return interceptSmartpageExport(result);
  }
  return result;
}
