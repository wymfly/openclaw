---
name: wecom-smartsheet-schema
description: 企业微信智能表格结构管理。用于查询/新增/更新/删除子表和字段，或在写入记录前确认字段类型与字段 ID。
metadata: { "openclaw": { "requires": { "config": ["channels.wecom"] } } }
---

# 企业微信智能表格结构管理

仅在当前会话是 `wecom` 渠道且 `wecom_mcp` tool 可用时使用。首次调用前应确认
`wecom_mcp` 已可用并且 `doc` category 能列出工具。

本技能描述 `wecom_mcp` 智能表格结构工具。direct `wecom_doc` 有自己的 action
命名和参数 schema；不要把 direct 工具的别名套用到 `wecom_mcp`。

## 调用格式

调用 `wecom_mcp` tool：

```json
{
  "action": "call",
  "category": "doc",
  "method": "smartsheet_get_fields",
  "args": {
    "docid": "DOCID",
    "sheet_id": "SHEETID"
  }
}
```

也可以用 `url` 代替 `docid`，但不要同时省略二者。

## 标准流程

1. 查询子表：`smartsheet_get_sheet`。
2. 查询字段：`smartsheet_get_fields`，保存 `field_id`、`field_title`、`field_type`。
3. 新增字段：`smartsheet_add_fields`。
4. 更新字段：`smartsheet_update_fields`，只能改标题/属性，不能改字段类型。
5. 删除字段：`smartsheet_delete_fields`，操作不可逆，删除前必须确认。

字段类型与添加字段示例见 [字段类型参考](references/field-types.md)。

## 约束

- 写入记录前必须先确认字段类型。
- `FIELD_TYPE_USER` 必须使用 `user_id`，只有姓名时优先使用文本字段。
- 日期字段值应按当前接口返回/目标表配置选择格式；如无更多上下文，优先使用 13 位毫秒时间戳字符串。
- 删除子表、删除字段是不可逆操作，必须先向用户确认目标。
- direct `wecom_doc` 的别名映射：`smartsheet_get_sheets` 对应 `smartsheet_get_sheet`，`smartsheet_del_sheet` 对应 `smartsheet_delete_sheet`，`smartsheet_del_fields` 对应 `smartsheet_delete_fields`。不要在 `wecom_mcp` 中使用 direct 别名。
- 视图、字段分组、权限规则等 action 只有在当前工具 schema 中明确列出时才能调用；未列出的工具不要猜测。
