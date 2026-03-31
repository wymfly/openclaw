## ADDED Requirements

### Requirement: Config tab supports model fallback chain editing
Config tab SHALL 在 model 选择器下方渲染 fallback 模型链编辑器，支持有序列表的添加、删除和排序。

#### Scenario: Add fallback model
- **WHEN** 用户点击 "添加 Fallback" 按钮并从模型列表中选择一个模型
- **THEN** SHALL 将该模型追加到 fallback 列表末尾，调用 agent config 更新 API 保存

#### Scenario: Remove fallback model
- **WHEN** 用户点击某 fallback 模型条目的删除按钮
- **THEN** SHALL 从 fallback 列表中移除该模型并保存

#### Scenario: Reorder fallback models
- **WHEN** 用户通过上下箭头按钮调整 fallback 模型顺序
- **THEN** SHALL 更新列表顺序并保存，优先级从上到下递减

#### Scenario: Empty fallback list
- **WHEN** fallback 列表为空
- **THEN** SHALL 显示提示文本 "无 fallback 模型，主模型不可用时将报错"（i18n key: `agents.noFallback`）
