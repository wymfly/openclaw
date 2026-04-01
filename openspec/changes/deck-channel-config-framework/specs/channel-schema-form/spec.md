## ADDED Requirements

### Requirement: ChannelSchemaForm generates form from JSON Schema

ChannelSchemaForm SHALL 接收 JSON Schema 和 configUiHints，动态生成对应的配置表单。

#### Scenario: String field rendering

- **WHEN** schema 定义 `{ type: "string", description: "Bot Token" }`
- **THEN** SHALL 渲染 Input 组件，label 为 "Bot Token"（或 schema title）

#### Scenario: Enum field rendering

- **WHEN** schema 定义 `{ type: "string", enum: ["webhook", "polling"] }`
- **THEN** SHALL 渲染 Select 下拉组件，选项为 "webhook" 和 "polling"

#### Scenario: Sensitive field rendering

- **WHEN** configUiHints 标记某字段为 sensitive
- **THEN** SHALL 渲染 PasswordField 组件（密码输入模式，带显示/隐藏切换）

#### Scenario: Boolean field rendering

- **WHEN** schema 定义 `{ type: "boolean" }`
- **THEN** SHALL 渲染 Switch 组件

#### Scenario: Unknown type fallback

- **WHEN** schema 定义未识别的类型或复杂嵌套
- **THEN** SHALL 渲染只读 JSON 展示，附 "在 Config Editor 中编辑" 链接

### Requirement: ChannelSchemaForm respects configUiHints

表单 SHALL 根据 configUiHints 控制字段排序、分组和帮助文本。

#### Scenario: Field ordering

- **WHEN** configUiHints 指定 `order: ["token", "webhook_url", "secret"]`
- **THEN** 表单字段 SHALL 按此顺序渲染

#### Scenario: Section grouping

- **WHEN** configUiHints 定义 sections（如 "基本配置"、"高级设置"）
- **THEN** SHALL 将字段分组渲染在对应的 Card 区域内

#### Scenario: Help text display

- **WHEN** configUiHints 为某字段提供 help 文本
- **THEN** SHALL 在字段旁显示帮助图标，hover 时展示 help 内容（使用 FieldHelpPopover）

### Requirement: ChannelSchemaForm validates and saves

表单 SHALL 根据 JSON Schema 验证输入，通过后调用 config 保存 API。

#### Scenario: Required field validation

- **WHEN** schema 定义字段为 required 且用户未填写
- **THEN** SHALL 显示验证错误（红色边框 + 错误提示文本）

#### Scenario: Save configuration

- **WHEN** 用户填写完成并点击保存按钮
- **THEN** SHALL 调用 config 更新 API 保存渠道配置，成功后显示保存成功通知
