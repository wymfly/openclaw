# 单元格值格式参考

本文件用于 `wecom_mcp` 智能表格记录写入。direct `wecom_doc` 有独立的
action 和参数 schema，不要把 direct 工具参数自动套用到 `wecom_mcp`。

## key 选择

- `smartsheet_add_records`：仅使用字段标题作为 `values` 的 key。
- `smartsheet_update_records`：可通过 `key_type` 指定字段标题或字段 ID。
- direct `wecom_doc` 对 `smartsheet_add_records/get_records/update_records` 的字段 ID 规则只适用于 direct 工具表面，不要自动套用到 `wecom_mcp`。

## 各字段类型的值格式

### 1. 文本 (`FIELD_TYPE_TEXT`)

必须使用数组格式，外层方括号不可省略：

```json
"字段标题": [{ "type": "text", "text": "内容" }]
```

### 2. 数字 / 货币 / 百分比 / 进度

直接传数字：

```json
"金额": 100,
"完成率": 0.6,
"进度": 80
```

### 3. 复选框 (`FIELD_TYPE_CHECKBOX`)

直接传布尔值：

```json
"已完成": true
```

### 4. 单选 / 多选

必须使用数组格式，不能直接传字符串：

```json
"优先级": [{ "text": "高" }],
"标签": [{ "text": "紧急", "style": 17 }, { "text": "重要", "style": 12 }]
```

已存在的选项应优先通过 `id` 匹配，`id` 可从 `smartsheet_get_fields` 返回中获取。
新增选项时不填 `id`。`style` 为可选颜色值，范围 1-27。

### 5. 日期时间 (`FIELD_TYPE_DATE_TIME`)

优先按目标表返回格式和字段配置填写。常见可用格式：

```json
"截止日期": "2026-01-15 14:30:00",
"创建日期": "2026-01-15"
```

如果 direct `wecom_doc` 或实际企业微信接口返回 `invalid datetime field`，可改用 13 位毫秒时间戳字符串：

```json
"截止日期": "1768468200000"
```

### 6. 手机号 / 邮箱 / 条码

直接传字符串：

```json
"电话": "13800138000",
"邮箱": "test@example.com",
"条码": "978-3-16-148410-0"
```

### 7. 成员 (`FIELD_TYPE_USER`)

数组格式，必须传 `user_id`，不是姓名。只有姓名时，应先用通讯录能力查到 `userid`；查不到时改用文本字段。

```json
"负责人": [{ "user_id": "zhangsan" }]
```

多个成员：

```json
"负责人": [{ "user_id": "zhangsan" }, { "user_id": "lisi" }]
```

### 8. 超链接 (`FIELD_TYPE_URL`)

数组格式，目前通常只写一个链接。链接字段名是 `link`，不是 `url`。

```json
"参考链接": [{ "type": "url", "text": "官网", "link": "https://example.com" }]
```

### 9. 图片 (`FIELD_TYPE_IMAGE`)

数组格式，必须直接在 cell value 中传入 OpenClaw 运行环境可读取的本地路径：

```json
"封面": [{ "image_path": "/absolute/path/image.png", "title": "图片标题" }]
```

`wecom_mcp` 拦截器会读取本地文件，调用上传接口，并把 `image_path` 替换为企业微信需要的
`image_url`。不要手动调用 `upload_doc_image`，不要手动 base64 编码。若路径方式返回错误，直接把错误码和错误信息告知用户。

### 10. 地理位置 (`FIELD_TYPE_LOCATION`)

数组格式：

```json
"地点": [
  {
    "source_type": 1,
    "id": "地点ID",
    "latitude": "39.9",
    "longitude": "116.3",
    "title": "北京"
  }
]
```

### 11. 文件 / 附件 (`FIELD_TYPE_ATTACHMENT`)

数组格式，必须直接在 cell value 中传入 OpenClaw 运行环境可读取的本地路径：

```json
"文件": [{ "file_path": "/absolute/path/file.pdf" }]
```

`wecom_mcp` 拦截器会读取本地文件，调用上传接口，并把 `file_path` 替换为企业微信需要的
`file_id`。不要手动调用 `upload_doc_file` 或 `upload_doc_image`，不要手动 base64 编码。

## 本地路径限制

- 单个文件不超过 10 MB。
- 单次记录写入中所有本地文件总计不超过 20 MB。
- 路径必须是 OpenClaw 服务进程可读取的本地路径。

## 易错点

- 文本、单选、多选、成员、链接、图片、文件通常是数组格式。
- `URL` 的链接字段是 `link`，不是 `url`。
- `FIELD_TYPE_USER` 需要 `user_id`，不是姓名。
- 读取整张子表时不要传 `field_titles: []`、`field_ids: []`、`record_ids: []` 或 `sort: []`。
- Webhook 兜底写入的字段格式与本文件不同，不要混用。
