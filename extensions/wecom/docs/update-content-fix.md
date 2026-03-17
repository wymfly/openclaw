# 企微文档批量更新修复指南

## 问题背景

企业微信文档 API 的 `batch_update` 接口存在以下限制：

1. **索引基于快照**：所有操作的索引基于请求发送时的文档快照
2. **原子性**：批量操作中一个失败则全部回滚
3. **段落验证**：`insert_text` 必须指向已有 Run 元素，不能在空段落执行
4. **版本控制**：`version` 参数用于并发控制（与最新版本差≤100）

## 常见问题

### ParagraphValidator cannot find p's parent

**原因**：在空段落或无效位置插入内容

**解决方案**：

```typescript
// 错误：直接在空位置插入文本
requests: [
  { insert_paragraph: { location: { index: 1 } } },
  { insert_text: { location: { index: 1 }, text: "内容" } }, // ❌ 索引错误
];

// 正确：使用顺序模式或正确计算索引
requests: [
  { insert_paragraph: { location: { index: 1 } } },
  { insert_text: { location: { index: 2 }, text: "内容" } }, // ✅ index+1
];
```

### TextValidator cannot find p parent

**原因**：`insert_text` 操作的目标段落在文档快照中不存在

**解决方案**：每次操作前获取最新文档结构

## 推荐方案

### 方案 A：顺序模式（推荐，默认）

```typescript
await docClient.updateDocContent({
  agent, docId,
  requests: [...],
  batchMode: false  // 默认：顺序执行，每次获取最新版本
});
```

**优点**：

- 可靠性高
- 自动处理版本和索引
- 适合复杂场景

**缺点**：

- API 调用次数较多

### 方案 B：批量模式（高性能场景）

```typescript
await docClient.updateDocContent({
  agent,
  docId,
  requests: [
    { insert_paragraph: { location: { index: 1 } } },
    { insert_text: { location: { index: 2 }, text: "内容" } },
  ],
  batchMode: true, // 批量执行，基于同一快照
  version: 123, // 必须提供版本号
});
```

**优点**：

- API 调用次数少
- 性能更好

**缺点**：

- 需要精确计算索引
- 所有操作基于同一快照

### 方案 C：使用 init_content（创建文档）

```typescript
await docClient.createDoc({
  agent,
  docName: "新文档",
  docType: "doc",
  init_content: ["# 标题", "第一段内容", { type: "image", url: "https://..." }, "第二段内容"],
});
```

**优点**：

- 最简单可靠
- 自动处理分段

**缺点**：

- 仅适用于创建文档

## API 限制速查

| 操作       | 限制             |
| ---------- | ---------------- |
| 批量操作数 | 1-30 个 requests |
| 版本差     | ≤100             |
| 新增行     | ≤1000            |
| 新增列     | ≤200             |
| 单元格总数 | ≤10000           |
| 查询范围   | 行≤1000, 列≤200  |

## 错误码

| 错误               | 原因           | 解决方案                 |
| ------------------ | -------------- | ------------------------ |
| ParagraphValidator | 段落位置无效   | 使用正确索引或顺序模式   |
| TextValidator      | 目标段落不存在 | 先创建段落或获取最新结构 |
| DrawingValidator   | 图片位置无效   | 在有效段落插入           |
| version mismatch   | 版本过旧       | 重新获取最新文档         |

## 最佳实践

1. **创建文档**：使用 `init_content`（最可靠）
2. **更新文档**：使用顺序模式（`batchMode: false`，默认）
3. **批量追加**：简单场景可用批量模式（需精确计算索引）
4. **并发控制**：始终传递 `version` 参数
5. **错误处理**：捕获异常并重试（最多 3 次）

## 相关文档

- [API 使用指南](./api-usage-guide.md)
- [示例代码](./examples.md)
