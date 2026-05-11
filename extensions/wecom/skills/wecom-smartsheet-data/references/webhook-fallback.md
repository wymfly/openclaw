# 智能表格 Webhook 兜底写入

当 `wecom_mcp` 调用 `smartsheet_add_records` / `smartsheet_update_records` 返回 `851003` 或 `errmsg` 包含 `no authority` 时，可临时切换到智能表格的“接收外部数据” Webhook。

## 使用条件

只在以下情况使用：

- `errcode` 为 `851003`。
- `errmsg` 明确包含 `no authority`、可见范围、企业规模限制等信息。

不要用 Webhook 掩盖参数错误、字段不存在、文档不存在等普通错误。

## 需要用户提供

让用户临时提供两项信息，用完即弃，不写入配置：

- Webhook 完整 URL。
- “接收外部数据”页面给出的 schema 示例 JSON。

## 请求格式

```json
{
  "add_records": [
    {
      "values": {
        "fABCD1": "标题",
        "fABCD2": [{ "text": "未开始" }],
        "fABCD3": "1742400000000"
      }
    }
  ]
}
```

字段 key 使用用户提供 schema 里的字段 ID。不要把 MCP 的 `field_title` / `field_id` 格式和 Webhook 格式混用。

## 注意

- Webhook URL 等同写入密钥，不要保存。
- 更新记录通常只能更新通过 Webhook 写入的记录。
- 日期值使用毫秒时间戳字符串。
- 图片字段使用纯 base64，不要带 `data:image/...;base64,` 前缀。
- 附件文件字段通常不适合 Webhook 兜底。
