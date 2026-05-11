---
name: wecom-smartsheet-data
description: 企业微信智能表格数据管理。用于查询、添加、更新、删除智能表格记录，或把结构化数据写入智能表格。
metadata: { "openclaw": { "requires": { "config": ["channels.wecom"] } } }
---

# 企业微信智能表格数据管理

仅在当前会话是 `wecom` 渠道且 `wecom_mcp` tool 可用时使用。首次调用前应确认
`wecom_mcp` 已可用并且 `doc` category 能列出工具。

本技能描述 `wecom_mcp` 的会话工具用法。不要把 direct `wecom_doc` 的 action
或参数自动套用到 `wecom_mcp`；如需使用 direct `wecom_doc`，只调用当前工具 schema
中明确列出的 action。

## 调用格式

调用 `wecom_mcp` tool：

```json
{
  "action": "call",
  "category": "doc",
  "method": "smartsheet_add_records",
  "args": {
    "docid": "DOCID",
    "sheet_id": "SHEETID",
    "records": [
      {
        "values": {
          "任务名称": [{ "type": "text", "text": "整理发票" }]
        }
      }
    ]
  }
}
```

## 标准流程

1. 先通过 `smartsheet_get_sheet` 确认 `sheet_id`。
2. 再通过 `smartsheet_get_fields` 确认字段标题、字段 ID 和字段类型。
3. 按字段类型构造 `records[].values`，格式见 [单元格值格式参考](references/cell-value-formats.md)。
4. 添加记录用 `smartsheet_add_records`，按字段标题作为 `values` 的 key。
5. 更新记录先用 `smartsheet_get_records` 获取 `record_id`，再用 `smartsheet_update_records`。更新记录可以显式传 `key_type`。
6. 删除记录用 `smartsheet_delete_records`，操作不可逆，必须先确认。

## Surface 选择

- 在企业微信会话里优先使用 `wecom_mcp`，因为它绑定当前会话、账号和企业微信 MCP server。
- 只有在系统明确暴露 direct `wecom_doc` tool、且目标 action 出现在该工具 schema 中时，才使用 direct `wecom_doc`。
- 不要调用 `smartsheet_add_external_records` 或 `smartsheet_update_external_records`。它们不是 Wedoc direct endpoint。外部数据写入只能作为 Webhook 兜底流程处理，且请求结构与 `wecom_mcp` 记录写入不同。

## key_type 规则

- `wecom_mcp` 的 `smartsheet_add_records` 使用字段标题作为 key，不要为了添加记录主动传字段 ID，除非当前工具 schema 明确提供 `key_type`。
- `wecom_mcp` 的 `smartsheet_update_records` 支持 `CELL_VALUE_KEY_TYPE_FIELD_TITLE` 或 `CELL_VALUE_KEY_TYPE_FIELD_ID`。
- direct `wecom_doc` 对 `smartsheet_add_records/get_records/update_records` 的 `FIELD_ID` 规则只适用于 direct 工具表面，不要套用到 `wecom_mcp`。

## 读取记录注意事项

读取整张子表时只传必要参数：

```json
{
  "docid": "DOCID",
  "sheet_id": "SHEETID"
}
```

不要为了“表示不限制”而传 `field_titles: []`、`field_ids: []` 或 `sort: []`。企业微信当前接口会把空字段过滤数组理解成“返回空字段集合”，导致记录存在但 `values` 为空对象。只有确实要按字段筛选时才传非空 `field_titles` 或 `field_ids`。

## 图片和文件字段

本地插件会在调用前自动处理以下值：

```json
{
  "封面": [{ "image_path": "/absolute/path/cover.png", "title": "封面" }],
  "附件": [{ "file_path": "/absolute/path/report.pdf" }]
}
```

插件会把 `image_path` 上传为 `image_url`，把 `file_path` 上传为 `file_id`，再调用企业微信 MCP。不要手动 base64 编码，也不要先调用 `upload_doc_image` / `upload_doc_file`。如果路径方式失败，应直接把错误码和错误信息告诉用户，不要改走未验证的上传路径。

## 错误处理

- 返回 `errcode != 0` 时，把 `errcode` 和 `errmsg` 告知用户。
- 返回 `851003` 或 `errmsg` 包含 `no authority` 时，可使用 [Webhook 兜底写入](references/webhook-fallback.md)。
- 写入字段值前，如果字段类型不确定，必须先查字段，不要猜。
- 本技能没有列出的 action 或参数，不要猜测调用。
