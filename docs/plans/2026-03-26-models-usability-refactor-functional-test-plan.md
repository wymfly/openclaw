# Models Usability Refactor — 功能测试计划

**目标**：验证模型模块重构后，CatalogTab 和 Agent ModelCombobox 只显示已配置且可用的模型，全量目录仅在 AddProviderDialog 中作为参考。

**前置条件**：

- [ ] Gateway 从本地源码运行（`scripts/dev/deck-dev.sh`）
- [ ] Dashboard 已启动（`:3000`）
- [ ] `NO_PROXY=localhost,127.0.0.1` 已设置
- [ ] 至少 1 个已配置 provider 有有效 API Key（如 deepseek）

**测试方式**：Playwright MCP 交互式验证

---

## Group A: Backend RPC 验证（6 用例）

| ID   | 优先级 | 测试点                       | 操作                                               | 预期结果                                                         |
| ---- | ------ | ---------------------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| A1.1 | P0     | models.configured 端点可达   | `curl http://localhost:3000/api/models/configured` | 返回 JSON `{ models: [...] }`，HTTP 200                          |
| A1.2 | P0     | 仅返回已配置 provider 的模型 | 对比 `/api/models/configured` 和 `/api/models`     | configured 数量远小于全量（全量 800+，configured 通常 < 50）     |
| A1.3 | P0     | authStatus 字段存在          | 检查 configured 返回的每个模型                     | 每个模型有 `authStatus` 字段（ready/warning/missing/unknown）    |
| A1.4 | P1     | cost 数据合并                | 检查 configured 返回的模型                         | 已知模型（如 deepseek-chat）有 `cost.input`/`cost.output` 非零值 |
| A1.5 | P1     | 无 provider 配置时返回空     | 移除所有 provider 后请求                           | 返回 `{ models: [] }`                                            |
| A1.6 | P1     | models.list 向后兼容         | `curl http://localhost:3000/api/models`            | 仍返回 800+ 全量模型（不受重构影响）                             |

---

## Group B: CatalogTab UI（10 用例）

| ID    | 优先级 | 测试点                    | 操作                          | 预期结果                                                        |
| ----- | ------ | ------------------------- | ----------------------------- | --------------------------------------------------------------- |
| B1.1  | P0     | CatalogTab 只显示可用模型 | 打开 Models 面板 → 目录 Tab   | 左侧 ProviderList 仅列出已配置 provider（非 800+ 全量）         |
| B1.2  | P0     | Provider 树分组正确       | 观察左侧列表                  | 每个 provider 展示为可折叠组，下方列出其模型                    |
| B1.3  | P0     | 认证状态指示器            | 观察 provider 名称旁的小圆点  | auth=ready 显示绿色，warning 显示黄色，missing 显示灰色         |
| B1.4  | P1     | 模型详情面板              | 点击某个模型                  | 右侧显示模型详情（价格、上下文窗口、推理能力等）                |
| B1.5  | P1     | Provider 概览面板         | 点击 provider 名称            | 右侧显示该 provider 所有模型的概览表                            |
| B1.6  | P1     | 空状态提示                | 无已配置 provider 时          | 显示"暂无可用模型" + "请先在「提供商配置」中添加并配置 API Key" |
| B1.7  | P1     | 模型数量徽标              | 观察 provider 名称右侧数字    | 显示该 provider 的模型数量                                      |
| B1.8  | P2     | Provider 展开/折叠        | 点击 provider 的 chevron 图标 | 展开/折叠模型列表                                               |
| B1.9  | P2     | 默认模型标识              | 如果某模型是默认模型          | 模型名称旁显示星标 ⭐                                           |
| B1.10 | P2     | Allowlist 开关            | 切换顶部"模型白名单"开关      | 开启时显示启用/未启用计数，关闭时显示"所有模型可用"             |

---

## Group C: Agent ModelCombobox（7 用例）

| ID   | 优先级 | 测试点                 | 操作                                          | 预期结果                                                     |
| ---- | ------ | ---------------------- | --------------------------------------------- | ------------------------------------------------------------ |
| C1.1 | P0     | 下拉菜单仅显示可用模型 | 进入 Agent 详情 → Config Tab → 点击模型输入框 | 下拉列表只显示已配置 provider 的模型（非全量 800+）          |
| C1.2 | P0     | 搜索过滤               | 在 combobox 中输入 "deep"                     | 只显示匹配的模型（如 deepseek-chat）                         |
| C1.3 | P0     | 选择模型后保存         | 选择一个模型 → 保存配置                       | 模型 ID 正确写入 agent config，Overview Tab 显示新选择的模型 |
| C1.4 | P1     | Provider 分组显示      | 打开下拉菜单                                  | 模型按 provider 分组，每组有 provider 名称头                 |
| C1.5 | P1     | 当前值回显             | 已有模型配置时进入 Config Tab                 | combobox 显示当前配置的模型 ID                               |
| C1.6 | P2     | 最大显示数量           | 不搜索直接打开下拉                            | 最多显示 50 个模型                                           |
| C1.7 | P2     | 外部点击关闭           | 打开下拉菜单后点击菜单外区域                  | 下拉菜单关闭                                                 |

---

## Group D: FallbacksTab（6 用例）

| ID   | 优先级 | 测试点               | 操作                              | 预期结果                                 |
| ---- | ------ | -------------------- | --------------------------------- | ---------------------------------------- |
| D1.1 | P0     | Fallback 链加载      | 进入 Models → 回退链 Tab          | 显示当前 primary model 和 fallback 列表  |
| D1.2 | P0     | 模型选择仅限可用模型 | 点击"添加回退模型"的 Select       | 下拉列表仅显示已配置 provider 的可用模型 |
| D1.3 | P1     | Primary 模型显示     | 观察顶部卡片                      | 显示当前主力模型名称和 provider          |
| D1.4 | P1     | 认证警告             | Fallback 链中包含未配置认证的模型 | 显示认证警告提示                         |
| D1.5 | P2     | 拖拽排序             | 拖动 fallback 模型卡片            | 重新排序后自动保存                       |
| D1.6 | P2     | 文本/图像链独立      | 分别配置文本和图像模型链          | 两条链互不影响                           |

---

## Group E: AddProviderDialog + 全量目录（5 用例）

| ID   | 优先级 | 测试点                   | 操作                                   | 预期结果                                           |
| ---- | ------ | ------------------------ | -------------------------------------- | -------------------------------------------------- |
| E1.1 | P0     | 对话框打开时加载全量目录 | Provider Config Tab → 点击"添加供应商" | 对话框打开，可选择 API 格式和认证类型              |
| E1.2 | P1     | API 格式下拉             | 点击 API 格式选择器                    | 显示 openai-completions, anthropic-messages 等选项 |
| E1.3 | P1     | 填写 API Key             | 输入 provider 名称 + API Key           | 输入框接受值，无报错                               |
| E1.4 | P1     | 提交后 usableModels 刷新 | 填写完整信息 → 点击提交                | 对话框关闭，CatalogTab 立即显示新 provider 的模型  |
| E1.5 | P2     | 模型列表编辑             | 在对话框中添加/删除自定义模型          | 模型列表可增减                                     |

---

## Group F: Auto-Refresh 联动（5 用例）

| ID   | 优先级 | 测试点                               | 操作                                        | 预期结果                                 |
| ---- | ------ | ------------------------------------ | ------------------------------------------- | ---------------------------------------- |
| F1.1 | P0     | 修改 Provider config 后刷新          | Provider Config Tab → 修改 API Key → 保存   | CatalogTab 刷新，模型列表更新            |
| F1.2 | P1     | Probe 成功后刷新                     | Provider Config Tab → 点击"运行诊断" → 成功 | CatalogTab 模型列表自动更新              |
| F1.3 | P1     | 新增 Provider 后 Agent Combobox 更新 | 添加新 provider → 切换到 Agent Config Tab   | ModelCombobox 能搜索到新 provider 的模型 |
| F1.4 | P2     | 删除 Provider 后模型消失             | 移除一个 provider 的配置 → 查看 CatalogTab  | 该 provider 的模型不再显示               |
| F1.5 | P2     | 网络失败时 fallback                  | 暂停 Gateway → 触发 fetchUsableModels       | 不崩溃，保持当前已有的 usableModels      |

---

## Group G: i18n 和主题（4 用例）

| ID   | 优先级 | 测试点     | 操作                               | 预期结果                                                        |
| ---- | ------ | ---------- | ---------------------------------- | --------------------------------------------------------------- |
| G1.1 | P1     | 中文空状态 | 设置中文 → 无模型时查看 CatalogTab | 显示"暂无可用模型" + "请先在「提供商配置」中添加并配置 API Key" |
| G1.2 | P1     | 英文空状态 | 切换英文 → 无模型时查看 CatalogTab | "No usable models" + "Add a provider..."                        |
| G1.3 | P2     | 暗色模式   | 切换暗色主题                       | CatalogTab、ModelCombobox、FallbacksTab 的色彩变量正确应用      |
| G1.4 | P2     | 响应式布局 | 缩小浏览器窗口到 768px             | ProviderList 和详情面板合理布局                                 |

---

## 测试汇总

| Group    | 描述                | P0     | P1     | P2     | 合计   |
| -------- | ------------------- | ------ | ------ | ------ | ------ |
| A        | Backend RPC         | 3      | 3      | 0      | 6      |
| B        | CatalogTab UI       | 3      | 4      | 3      | 10     |
| C        | Agent ModelCombobox | 3      | 2      | 2      | 7      |
| D        | FallbacksTab        | 2      | 2      | 2      | 6      |
| E        | AddProviderDialog   | 1      | 3      | 1      | 5      |
| F        | Auto-Refresh        | 1      | 2      | 2      | 5      |
| G        | i18n 和主题         | 0      | 2      | 2      | 4      |
| **合计** |                     | **13** | **18** | **12** | **43** |

---

## 执行顺序建议

1. **P0 优先**（13 用例）：A1.1-A1.3 → B1.1-B1.3 → C1.1-C1.3 → D1.1-D1.2 → E1.1 → F1.1
2. **P1 补充**（18 用例）：按 Group 顺序执行
3. **P2 收尾**（12 用例）：按 Group 顺序执行
