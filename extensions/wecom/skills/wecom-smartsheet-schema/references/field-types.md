# 智能表格字段类型参考

## 常用字段类型

| 枚举值                     | 说明     | 写入建议                                                    |
| -------------------------- | -------- | ----------------------------------------------------------- |
| `FIELD_TYPE_TEXT`          | 文本     | 名称、描述、自由文本                                        |
| `FIELD_TYPE_NUMBER`        | 数字     | 金额、数量、评分                                            |
| `FIELD_TYPE_CHECKBOX`      | 复选框   | true / false                                                |
| `FIELD_TYPE_DATE_TIME`     | 日期时间 | 优先传 13 位毫秒时间戳字符串，或按表字段配置传可接受格式    |
| `FIELD_TYPE_IMAGE`         | 图片     | 记录值中使用 `image_path`，由插件上传替换                   |
| `FIELD_TYPE_ATTACHMENT`    | 文件     | 记录值中使用 `file_path`，由插件上传替换                    |
| `FIELD_TYPE_USER`          | 成员     | 需要 `user_id`                                              |
| `FIELD_TYPE_URL`           | 链接     | `[{ "type": "url", "text": "...", "link": "https://..." }]` |
| `FIELD_TYPE_SELECT`        | 多选     | `[{ "text": "选项A" }, { "text": "选项B" }]`                |
| `FIELD_TYPE_SINGLE_SELECT` | 单选     | `[{ "text": "选项A" }]`                                     |
| `FIELD_TYPE_PROGRESS`      | 进度     | 通常为 0-100 整数                                           |
| `FIELD_TYPE_CURRENCY`      | 货币     | number                                                      |
| `FIELD_TYPE_PERCENTAGE`    | 百分比   | 按目标字段配置确认 0-1 或 0-100                             |
| `FIELD_TYPE_PHONE_NUMBER`  | 手机号   | string                                                      |
| `FIELD_TYPE_EMAIL`         | 邮箱     | string                                                      |
| `FIELD_TYPE_BARCODE`       | 条码     | string                                                      |
| `FIELD_TYPE_LOCATION`      | 地理位置 | 位置对象数组                                                |

## 添加字段示例

```json
{
  "action": "call",
  "category": "doc",
  "method": "smartsheet_add_fields",
  "args": {
    "docid": "DOCID",
    "sheet_id": "SHEETID",
    "fields": [
      { "field_title": "任务名称", "field_type": "FIELD_TYPE_TEXT" },
      {
        "field_title": "优先级",
        "field_type": "FIELD_TYPE_SINGLE_SELECT",
        "property_single_select": {
          "is_quick_add": true,
          "options": [{ "text": "高" }, { "text": "中" }, { "text": "低" }]
        }
      },
      {
        "field_title": "截止日期",
        "field_type": "FIELD_TYPE_DATE_TIME",
        "property_date_time": { "format": "yyyy-mm-dd", "auto_fill": false }
      },
      {
        "field_title": "金额",
        "field_type": "FIELD_TYPE_NUMBER",
        "property_number": { "decimal_places": 2, "use_separate": false }
      },
      { "field_title": "附件", "field_type": "FIELD_TYPE_ATTACHMENT" }
    ]
  }
}
```

## 注意

- `smartsheet_update_fields` 不能把已有字段从一种类型改成另一种类型。
- 企业微信当前 API 对数字、日期、单选/多选等字段要求 `property_*` 属性；插件会为常见类型补默认属性，但明确传入更可靠。
- `smartsheet_update_fields` 必须带字段原始 `field_type`；如果没有传，插件会先调用 `smartsheet_get_fields` 按 `field_id` 补回原类型。
- 单选/多选值必须和已有选项匹配；不确定时先查字段详情。
- 成员字段不要直接填姓名。先查 `userid`，或把该信息存入文本字段。
