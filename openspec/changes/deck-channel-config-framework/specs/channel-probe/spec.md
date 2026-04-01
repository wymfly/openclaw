## ADDED Requirements

### Requirement: Channel probe button triggers active connection test

渠道详情页 SHALL 提供 "测试连接" 按钮，点击后调用 `channels.status` API（`probe: true`），展示探测结果。

#### Scenario: Probe success

- **WHEN** 用户点击 "测试连接" 且渠道连接正常
- **THEN** SHALL 显示 "连接成功"（success 颜色），附探测延迟（如 "120ms"）

#### Scenario: Probe failure

- **WHEN** 探测返回错误
- **THEN** SHALL 显示 "连接失败"（destructive 颜色），附错误信息描述

#### Scenario: Probe timeout

- **WHEN** 探测超过 10s 未响应
- **THEN** SHALL 显示 "连接超时"（warning 颜色）

#### Scenario: Probe loading state

- **WHEN** 探测正在进行中
- **THEN** 按钮 SHALL 显示 loading spinner，禁止重复点击
