## ADDED Requirements

### Requirement: Logs store uses cursor-based incremental fetching

Logs store SHALL 使用 `logs.tail` 的 cursor 参数实现增量日志读取，避免每次获取全量数据。

#### Scenario: Initial fetch without cursor

- **WHEN** Logs 面板首次加载
- **THEN** SHALL 调用 `logs.tail`（不传 cursor），获取最新日志和 nextCursor

#### Scenario: Incremental fetch with cursor

- **WHEN** 轮询定时器触发且有 nextCursor
- **THEN** SHALL 调用 `logs.tail` 传入 `cursor: nextCursor`，仅获取新增日志

#### Scenario: Cursor expiration recovery

- **WHEN** `logs.tail` 返回 cursor 过期错误
- **THEN** SHALL 重置 cursor 为 null，重新执行初始 fetch

### Requirement: Logs store passes maxBytes parameter

Logs store SHALL 传递 `maxBytes` 参数（默认 64KB）控制单次响应大小。

#### Scenario: Large log volume

- **WHEN** 两次轮询间产生大量日志
- **THEN** 单次响应 SHALL 不超过 maxBytes 限制，剩余日志在下次轮询获取
