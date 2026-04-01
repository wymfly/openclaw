# 领域调研报告 — 企微集成与国内企业部署约束

> Date: 2026-03-10
> Role: domain-expert
> Status: Complete

---

## 1. 企业微信 API 深度调研

### 1.1 应用类型选择

企业微信提供三种应用模式：

| 类型         | 适用场景                                       | 我们的适配度 |
| ------------ | ---------------------------------------------- | ------------ |
| **自建应用** | 企业内部使用，corpId+corpsecret 认证，完全可控 | **推荐**     |
| 第三方应用   | ISV 为多企业提供 SaaS 服务，需上架企微应用市场 | 阶段2 可考虑 |
| 代开发应用   | 服务商代企业开发，企业授权后部署               | 不适用       |

**结论：阶段1 使用自建应用。** 理由：

- 金属 3D 打印企业是单一企业部署，不涉及多租户
- 自建应用无需上架审核，开发迭代快
- 消息收发、通讯录访问等 API 权限齐全
- 控制权完全在企业 IT 部门手中

> 来源：[企业微信开发者中心 - 开发前必读](https://developer.work.weixin.qq.com/document/path/90664)

### 1.2 消息接收机制

#### 回调 URL（Webhook）模式

企业微信**原生主力方式**是 HTTP Webhook 回调：

1. 在应用管理后台配置 **URL、Token、EncodingAESKey** 三个参数
2. 企业微信先发 GET 请求验证 URL 有效性（签名校验 + 返回明文 echostr）
3. 用户发消息时，企业微信 POST 加密消息体到回调 URL
4. 服务端需在 **5 秒内**响应，否则断连重试（最多 3 次）
5. 支持被动回复（在响应包中带回复消息）

> 来源：[回调配置](https://developer.work.weixin.qq.com/document/path/91116)、[接收消息概述](https://developer.work.weixin.qq.com/document/path/90238)

#### 消息加解密三种模式

| 模式         | 说明                      | 推荐度       |
| ------------ | ------------------------- | ------------ |
| 明文模式     | 不加密，仅签名校验        | 仅开发调试   |
| 兼容模式     | 同时推送明文和密文        | 过渡期用     |
| **安全模式** | AES-CBC 加密，PKCS#7 填充 | **生产必选** |

加密算法：AES-256-CBC，IV = AESKey 前 16 字节，明文 = 16字节随机串 + 4字节消息长度 + 消息体 + receiverId。

官方提供 C++、Python、PHP、Java、Go、C# 加解密库，**缺少 Node.js/TypeScript 官方库**，但社区有 [`WXBizMsgCrypt` TS 实现](https://github.com/fuchengjx/WXBizMsgCrypt)。

> 来源：[加解密方案说明](https://developer.work.weixin.qq.com/document/path/90968)

#### WebSocket 长连接模式（智能机器人）

**重要发现**：企业微信**已支持 WebSocket 长连接**，用于智能机器人场景：

- 网关地址：`wss://openws.work.weixin.qq.com`
- 协议命令：`aibot_subscribe`（鉴权）、`aibot_msg_callback`（接收消息）、`aibot_respond_msg`（回复消息）
- 支持 `msgtype=stream` 流式输出
- 需要心跳保活

**对我们的意义**：这个模式非常适合 AI Agent 场景——可以实现流式回复、避免 5 秒超时限制。但需确认该 API 是否面向所有自建应用开放，还是仅限特定类型。

> 来源：[接入协议概述](https://developer.work.weixin.qq.com/document/path/91366)、[OpenClaw-Wechat 插件](https://github.com/dingxiang-me/OpenClaw-Wechat)

### 1.3 消息发送

#### 主动推送 vs 被动回复

| 方式         | 说明                              | 限制                          |
| ------------ | --------------------------------- | ----------------------------- |
| **被动回复** | 在回调响应包中直接返回消息        | 必须 5 秒内返回，仅能回复一条 |
| **主动推送** | 调用 `POST /cgi-bin/message/send` | 有频率限制（见下）            |

#### 频率限制（关键约束）

| 场景             | 限制                                       |
| ---------------- | ------------------------------------------ |
| 每应用总量       | 不超过 `账号上限数 x 200` 人次/天          |
| 每应用对同一成员 | 不超过 **30 次/分钟**、**1000 次/小时**    |
| 群聊推送         | 不超过 **2 万人次/分**、**30 万人次/小时** |
| 群机器人 webhook | 不超过 **20 条/分钟**                      |

**对我们的影响**：AI Agent 的长对话场景下，30 次/分钟 对单用户足够。但如果 Agent 需要分段回复（比如流式输出拆成多条），需要注意计数。**建议优先使用 WebSocket stream 模式避免此限制。**

> 来源：[发送应用消息](https://developer.work.weixin.qq.com/document/path/90236)、[应用推送消息](https://developer.work.weixin.qq.com/document/path/90248)

### 1.4 支持的消息类型与富文本能力

| 消息类型          | 说明                                             | AI Agent 适用场景    |
| ----------------- | ------------------------------------------------ | -------------------- |
| **text**          | 纯文本，支持 `<@userid>` @人                     | 日常对话             |
| **markdown**      | 基础 markdown（标题、颜色标注、@人）             | 格式化回复           |
| **markdown_v2**   | 增强 markdown                                    | 更复杂的格式化输出   |
| **image**         | 图片消息                                         | 图表、截图           |
| **file**          | 文件消息                                         | 导出报告、数据文件   |
| **voice**         | 语音消息                                         | -                    |
| **news**          | 图文链接消息                                     | 知识卡片、文档链接   |
| **template_card** | 模板卡片（文本通知/图文展示/按钮交互/投票/多选） | 交互式回复、确认操作 |

#### Markdown 能力详情

**支持**：标题（1-6级）、加粗、链接、引用、3种颜色 `<font color="info/comment/warning">`

**不支持**：代码块（无语法高亮）、表格、内嵌图片、复杂列表嵌套

**关键限制**：企微 markdown 是**严重阉割版**，远不如标准 GFM。对于代码展示、数据表格等 AI 常见输出格式，需要：

- 代码 → 用 text 消息 + 等宽字体标记，或上传为文件
- 表格 → 用 template_card 或转换为图片
- 复杂报告 → 生成 HTML/PDF 文件后通过 file 消息发送

> 来源：[消息推送配置说明](https://developer.work.weixin.qq.com/document/path/91770)、[企业微信 Markdown 使用指南](https://www.yingdao.com/community/detaildiscuss?id=865050131578982400)

### 1.5 用户身份体系

#### 唯一标识

- **corpId + userId** 唯一标识一个员工（在企业内唯一）
- userId 由企业管理员创建时指定（通常是工号或邮箱前缀）
- 跨企业场景（第三方应用）使用 `open_userid`

**对平台设计的影响**：设计文档中的 `corpId + userId → platform userId` 映射方案正确。

#### OAuth2.0 认证流程

```
1. 构造授权链接 → 用户点击
   https://open.weixin.qq.com/connect/oauth2/authorize?
     appid=CORPID&redirect_uri=REDIRECT_URI&
     response_type=code&scope=snsapi_base&
     agentid=AGENTID&state=STATE#wechat_redirect

2. 用户授权 → 获得 code
   重定向到 redirect_uri?code=CODE&state=STATE

3. 用 code 换取用户身份
   GET /cgi-bin/auth/getuserinfo?access_token=TOKEN&code=CODE
   返回 { UserId, DeviceId }

4. 获取用户详细信息
   GET /cgi-bin/user/get?access_token=TOKEN&userid=USERID
   返回 { name, department, position, ... }
```

两种 scope：

- `snsapi_base`：静默授权，直接 302 跳转，获取 userId
- `snsapi_privateinfo`：手动授权，弹出确认页，可获取更多信息

**对我们的设计**：消息回调场景不需要 OAuth 流程——回调消息体中直接包含 `FromUserName`（即 userId）。OAuth 主要用于 Web 管理后台的登录认证。

> 来源：[构造网页授权链接](https://developer.work.weixin.qq.com/document/path/91120)、[开始开发](https://developer.work.weixin.qq.com/document/path/96440)

### 1.6 通讯录同步

#### API 能力

- 部门管理：创建/读取/更新/删除部门
- 成员管理：创建/读取/更新/删除成员，支持批量导入
- 获取部门成员列表、成员 ID 列表
- 标签管理

#### 增量回调

企业微信支持通讯录变更事件回调（成员变更、部门变更），但**安全策略调整后**：

- 回调通知仅返回 userId 和部门 ID
- 不再返回姓名、手机号等详细信息
- 需要通过 `获取成员ID列表` + `读取成员` 接口二次查询

**对平台设计的影响**：

- 初始同步：调用 `获取部门列表` + `获取部门成员详情` 全量拉取
- 增量同步：监听通讯录变更回调 → 拿到变更 ID → 查询详情 → 更新平台用户表
- 可获取：姓名、部门、职位、手机号、邮箱、头像、性别等

> 来源：[通讯录同步接口调整](https://developer.work.weixin.qq.com/document/path/96079)、[通讯录管理概述](https://developer.work.weixin.qq.com/document/path/90193)

---

## 2. 企微认证与身份关联

### 2.1 身份唯一性

| 标识            | 范围   | 说明                               |
| --------------- | ------ | ---------------------------------- |
| corpId          | 全局   | 企业唯一 ID，创建时生成，不可变    |
| userId          | 企业内 | 管理员指定，企业内唯一             |
| corpId + userId | 全局   | **全局唯一**，可作为平台用户映射键 |
| open_userid     | 跨企业 | 第三方应用获取的脱敏 ID            |

**结论**：`corpId + userId` 是可靠的全局唯一标识，无例外。设计文档的映射方案完全可行。

### 2.2 平台用户映射方案

```
企业微信
  corpId: "ww1234567890"
  userId: "xiaowang"
      ↓
平台用户表
  platformUserId: "uuid-xxx"
  wecomCorpId: "ww1234567890"
  wecomUserId: "xiaowang"
  name: "小王"
  department: "工艺部"
  position: "工艺工程师"
      ↓
路由/权限系统
```

### 2.3 部门与权限信息获取

通过通讯录 API 可获取完整的组织架构信息，用于平台权限分配：

```
GET /cgi-bin/user/get?userid=xiaowang
→ {
    "userid": "xiaowang",
    "name": "小王",
    "department": [1, 2],        // 所属部门 ID 列表（可多部门）
    "position": "工艺工程师",     // 职位
    "is_leader_in_dept": [0, 1], // 是否部门领导
    "direct_leader": ["zhangjie"], // 直属上级
    ...
  }
```

---

## 3. 企微 vs 钉钉 vs 飞书对比

### 3.1 Bot/应用 API 对比

| 维度         | 企业微信                            | 钉钉                                        | 飞书                                      |
| ------------ | ----------------------------------- | ------------------------------------------- | ----------------------------------------- |
| **消息接收** | HTTP Webhook + WebSocket 长连接     | HTTP Webhook + **Stream 模式**（WebSocket） | HTTP Webhook + **长连接**（WebSocket）    |
| **认证方式** | corpId + corpsecret → access_token  | AppKey + AppSecret → access_token           | App ID + App Secret → tenant_access_token |
| **消息加密** | AES-CBC，需手动解密                 | 签名校验（Stream 模式免解密）               | 长连接模式内置加密，免手动解密            |
| **公网要求** | Webhook 需公网 IP；WebSocket 不需要 | Stream 模式**不需要公网 IP**                | 长连接**不需要公网 IP**                   |
| **5秒超时**  | Webhook 有，WebSocket 无            | Stream 模式无超时限制                       | 长连接无超时限制                          |
| **流式输出** | WebSocket 支持 stream msgtype       | SDK 层面支持                                | SDK 层面支持                              |

### 3.2 消息类型对比

| 消息类型 | 企业微信                 | 钉钉                   | 飞书                               |
| -------- | ------------------------ | ---------------------- | ---------------------------------- |
| 文本     | text                     | text                   | text                               |
| Markdown | markdown（阉割版）       | markdown（标准度更高） | 富文本（类 markdown，渲染为 HTML） |
| 图片     | image                    | 通过 media 上传        | image                              |
| 文件     | file                     | file                   | file                               |
| 卡片     | template_card（5种模板） | ActionCard / FeedCard  | 消息卡片（JSON 模板，最灵活）      |
| 代码块   | **不支持**               | 支持（markdown 内）    | 支持（富文本内）                   |
| 表格     | **不支持**               | **不支持**             | 支持（富文本内）                   |

### 3.3 开发者体验对比

| 维度         | 企业微信                         | 钉钉                              | 飞书                              |
| ------------ | -------------------------------- | --------------------------------- | --------------------------------- |
| **文档质量** | 中等，结构清晰但示例少           | 良好，有开发者百科和 API Explorer | **最佳**，有完整的 SDK 文档和教程 |
| **SDK 支持** | 无官方 Node.js SDK，社区方案分散 | 官方多语言 SDK（Python/Java/Go）  | 官方多语言 SDK + feishu-bridge    |
| **调试工具** | 基础                             | API Explorer + 沙箱环境           | 完善的在线调试工具                |
| **接入门槛** | 较高（加解密、公网 IP）          | **最低**（Stream 模式零门槛）     | 低（长连接免公网）                |
| **Bot 生态** | 社区驱动                         | **最成熟**（500万+应用）          | 快速成长，AI 集成领先             |

### 3.4 统一通道抽象层可行性

**结论：可行，但需处理以下差异点。**

#### 可统一的部分（80%）

```typescript
interface ChannelAdapter {
  // 消息接收 — 三者都支持 WebSocket/长连接
  connect(): Promise<void>;
  onMessage(handler: (msg: IncomingMessage) => void): void;

  // 消息发送 — 三者都支持文本、markdown、文件
  sendText(userId: string, content: string): Promise<void>;
  sendMarkdown(userId: string, content: string): Promise<void>;
  sendFile(userId: string, fileUrl: string): Promise<void>;

  // 身份映射 — 三者都有 userId 概念
  resolveUser(channelUserId: string): Promise<PlatformUser>;
}
```

#### 差异点（需适配层处理）

| 差异项            | 处理策略                                                                              |
| ----------------- | ------------------------------------------------------------------------------------- |
| Markdown 语法差异 | 企微 markdown 能力最弱；需 markdown 标准化层，按通道降级渲染                          |
| 卡片/交互消息     | 三者格式完全不同；定义通用卡片 DSL，各通道适配器转换                                  |
| 文件上传方式      | 企微用 media API，钉钉用 media API，飞书用 file API；统一为先上传再发送               |
| 认证流程          | 企微 corpId+secret，钉钉 AppKey+AppSecret，飞书 AppId+AppSecret；抽象为 `ChannelAuth` |
| 加解密            | 企微需手动解密，钉钉/飞书 Stream 模式自动处理；在适配器内部屏蔽                       |

**架构建议**：参考 OpenClaw 已有的 channel 抽象模式（`src/channels`），定义 `PlatformChannel` 接口，企微/钉钉/飞书各自实现适配器。

---

## 4. 国内企业部署约束

### 4.1 金属 3D 打印企业 IT 基础设施现状

基于行业调研，典型的中型金属 3D 打印企业（如铂力特、华曙高科等的客户）IT 现状：

| 维度         | 现状                                    | 对平台的影响                |
| ------------ | --------------------------------------- | --------------------------- |
| **服务器**   | 自有机房或租用 IDC，1-3 台物理服务器    | 单机部署方案是必须的        |
| **网络**     | 有公网出口，但可能有防火墙限制          | 需考虑 LLM API 的网络通达性 |
| **运维能力** | 通常只有 1-2 个 IT 人员，非专职运维     | 部署必须极简，最好一键式    |
| **操作系统** | Windows Server / CentOS / Ubuntu        | 需要跨平台支持              |
| **容器化**   | Docker 普及率约 30-50%，K8s 极少        | Docker 作为可选项，不强依赖 |
| **数据库**   | 多为 MySQL / SQL Server                 | 平台用 SQLite 起步最省心    |
| **MES/ERP**  | 多数有国产 MES 系统（如华天软件、鼎捷） | 需预留 API 集成接口         |

> 来源：[3D 打印行业数字化报告](https://3dprint.ofweek.com/2025-06/ART-132101-8500-30664623.html)、[3D科学谷产业化分析](http://www.3dsciencevalley.com/?p=25468)

### 4.2 Docker 在国内企业的现状

**普及度**：中大型互联网/科技企业广泛使用，传统制造业渗透率较低。

**实际痛点**：

- **镜像拉取困难**：Docker Hub 在国内访问不稳定，官方镜像源减少
- 大型云服务商（阿里云、腾讯云）提供镜像加速，但有附加条件
- 高校镜像站（如中科大、清华）近年已限制或停止 Docker Hub 镜像
- **解决方案**：预构建离线镜像包，或使用企业内网镜像仓库

**对平台设计的影响**：

- 阶段1 提供 `docker save/load` 的离线部署方式
- 提供 docker-compose 一键启动脚本
- 考虑非 Docker 的直接部署方式（Node.js 直接运行）作为备选

> 来源：[Docker 国内镜像源大全](https://blog.csdn.net/weixin_29313547/article/details/158047240)

### 4.3 网络环境与 LLM API 访问

| 场景                                                | 可行性        | 说明                                               |
| --------------------------------------------------- | ------------- | -------------------------------------------------- |
| 调用 OpenAI/Claude API                              | 需代理或中转  | 多数企业无直接访问，需要配合代理服务或选用国内 LLM |
| 调用国内 LLM API（通义千问/文心一言/DeepSeek/Kimi） | **直接可用**  | 无网络障碍                                         |
| 私有化部署 LLM                                      | 需 GPU 服务器 | 推理成本高，中小企业难以承担                       |
| 混合方案                                            | **推荐**      | 非敏感对话用云端 API，敏感数据用本地模型           |

**建议方案**：

- 默认配置国内 LLM API（DeepSeek、通义千问等）
- OpenClaw 已支持多 provider 切换，无需平台层额外适配
- 为高安全要求场景预留本地模型接口（Ollama 等）

### 4.4 数据合规

#### 相关法规

| 法规                           | 施行日期 | 关键要求                                        |
| ------------------------------ | -------- | ----------------------------------------------- |
| 《个人信息保护法》(PIPL)       | 2021-11  | 收集/处理个人信息需告知同意；跨境传输需安全评估 |
| 《数据安全法》                 | 2021-09  | 数据分类分级；重要数据出境需安全评估            |
| 《网络数据安全管理条例》       | 2025-01  | 细化数据处理义务；可操作的治理框架              |
| 《促进和规范数据跨境流动规定》 | 2024-03  | 放宽部分场景的数据出境要求                      |

#### 对制造业的具体约束

1. **工艺参数**：可能属于"重要数据"（涉及核心技术），原则上不出境
2. **员工信息**：属于个人信息，处理需有合法基础（劳动关系），跨境需评估
3. **设备数据**：IoT 数据量大，通常不涉及出境，但需注意数据分级
4. **生产数据**：订单、产量等经营数据，企业自行决定分级

**平台设计建议**：

- 所有数据默认存储在企业本地服务器
- LLM API 调用时，仅发送必要的上下文（不含原始工艺参数）
- 提供"数据脱敏"选项：敏感字段在送出前自动替换
- 审计日志记录所有数据外传行为

> 来源：[数据出境安全管理政策问答](https://www.cac.gov.cn/2025-04/09/c_1745906286623776.htm)、[企业级 LLM 隐私与安全最佳实践](https://www.weitip.com/news/8605.html)

---

## 5. 参考实现调研

### 5.1 开源企微 Bot 框架/SDK

| 项目                                                                                  | 语言       | 星标 | 企微支持       | AI 集成                    | 特点                     |
| ------------------------------------------------------------------------------------- | ---------- | ---- | -------------- | -------------------------- | ------------------------ |
| [chatgpt-on-wechat](https://github.com/topics/wechat-bot)                             | Python     | 高   | 企微+公众号    | ChatGPT/Claude/DeepSeek 等 | 最成熟的企微 AI Bot 方案 |
| [Dify-Enterprise-WeChat-bot](https://github.com/luolin-ai/Dify-Enterprise-WeChat-bot) | Python     | 中   | 企微专用       | Dify API                   | 知识库+上下文管理        |
| [corpwechatbot](https://github.com/GentleCP/corpwechatbot)                            | Python     | 中   | 企微专用       | 无                         | 轻量 SDK，一行代码发消息 |
| [lingti-bot](https://github.com/ruilisi/lingti-bot)                                   | Go         | 中   | 企微+钉钉+飞书 | 16 种 AI 后端              | **单二进制，零依赖部署** |
| [ai-bot（智能微秘书）](https://github.com/yzqzy/ai-bot)                               | Node.js    | 中   | 企微+公众号    | ChatGPT/Dify/Coze          | 全平台管理后台           |
| [WXBizMsgCrypt](https://github.com/fuchengjx/WXBizMsgCrypt)                           | TypeScript | 低   | 加解密库       | 无                         | 企微消息加解密 TS 实现   |

### 5.2 值得借鉴的实现模式

#### chatgpt-on-wechat 的架构

```
消息入口（企微回调/个微/公众号）
    ↓
Channel 适配层（统一消息格式）
    ↓
Bot 层（LLM 调用 + 上下文管理）
    ↓
Plugin 系统（工具调用、知识库检索）
    ↓
回复生成 → Channel 适配层 → 发送
```

**可借鉴**：Channel 适配层的设计模式。

#### lingti-bot 的亮点

- 单二进制零依赖：适合运维能力弱的企业
- 通过"云中继"秒级完成企微回调验证，无需公网 IP
- 多平台统一接口（企微/钉钉/飞书/公众号）
- 按平台/频道配置不同 AI 模型

**可借鉴**：云中继模式解决公网 IP 问题的思路、多平台统一接口。

#### Dify-Enterprise-WeChat-bot 的知识库集成

- 利用 Dify 平台的知识库 + RAG 能力
- 独立会话管理（记忆用户上下文）
- 白名单控制交互对象

**可借鉴**：但我们不依赖 Dify，而是用 OpenClaw 的 Agent + Skills 体系实现类似能力。

### 5.3 最佳实践总结

1. **消息接收**：优先使用 WebSocket 长连接（企微 aibot / 钉钉 Stream / 飞书长连接），避免公网 IP 依赖和超时问题
2. **消息格式**：AI 回复默认用 markdown，遇到企微 markdown 不支持的内容自动降级为 text 或转文件
3. **会话管理**：按 userId + agentId 维护独立会话上下文
4. **错误处理**：回调失败时企微会重试 3 次，需做消息去重（`enable_duplicate_check`）
5. **安全**：生产环境必须用安全加密模式 + 可信 IP 白名单

---

## 6. 跨角色影响评估（Phase C）

### 6.1 对 product-strategist（产品策略）的约束

| 企微 API 限制                     | UX 影响                                 | 建议                                                    |
| --------------------------------- | --------------------------------------- | ------------------------------------------------------- |
| Markdown 能力弱（无代码块、表格） | AI 回复格式受限，无法优雅展示代码和数据 | 复杂内容转为文件/图片；提供"在网页中查看完整回复"的链接 |
| 消息频率限制（30 次/分/人）       | 流式输出不能拆太多条                    | 用 WebSocket stream 模式，或缓冲后一次性发送            |
| 模板卡片交互有限                  | 无法做复杂的多步表单交互                | 关键交互流程引导到 Web 管理后台                         |
| 被动回复 5 秒超时                 | Agent 思考时间长时无法被动回复          | 必须用主动推送或 WebSocket 模式                         |
| 微工作台内文本限制 20 字节        | 微信端体验极差                          | 引导用户使用企业微信客户端                              |

### 6.2 对 architect（架构师）的约束

| 部署约束                     | 架构影响                   | 建议                                 |
| ---------------------------- | -------------------------- | ------------------------------------ |
| Docker Hub 访问困难          | 在线拉镜像可能失败         | 提供离线镜像包 + 内网镜像仓库方案    |
| IT 运维能力弱                | 复杂编排方案不现实         | 阶段1 用 docker-compose，不引入 K8s  |
| 可能无法访问海外 LLM API     | 影响 AI 能力可用性         | 默认配置国内 LLM，支持代理配置       |
| 防火墙可能限制出站           | WebSocket 长连接可能被阻断 | 提供 HTTP 回调模式作为降级方案       |
| 服务器资源有限（8C16G 起步） | 容器数量受限               | 优化单容器资源占用，空闲空间自动休眠 |

### 6.3 通道抽象设计影响

| 差异点                     | 影响                                 | 建议                                             |
| -------------------------- | ------------------------------------ | ------------------------------------------------ |
| 企微 markdown 最弱         | 统一渲染层需要"最低公分母"或分层渲染 | 定义 RichMessage 中间格式，各通道适配器负责降级  |
| 钉钉/飞书 WebSocket 更成熟 | 企微的 WebSocket 模式可能有功能限制  | 保留 HTTP 回调作为兜底，WebSocket 作为首选       |
| 卡片消息格式完全不同       | 无法用统一 JSON 描述                 | 定义通用交互卡片 DSL，各适配器转换为平台特定格式 |

---

## 7. 补充调研：企微自助平台体验与部门自治

> 来源：team-lead 补充需求 — 平台定位为"企业级自助平台，让 claw 住在企业每个角落"

### 7.1 企微工作台与应用发现

#### 工作台机制

企微的"工作台"（Workbench）是员工发现和使用应用的核心入口：

- 自建应用创建后会自动出现在工作台中
- 管理员可设置应用的**可见范围**（部门/成员/标签），只有范围内成员能看到
- 支持**自定义展示**：应用图标、名称、描述，还可自定义工作台页面布局
- 员工点击应用图标即可进入应用主页（H5 页面或小程序）

> 来源：[设置工作台自定义展示](https://developer.work.weixin.qq.com/document/path/94620)、[企业自建应用](https://open.work.weixin.qq.com/wwopen/helpguide/detail?t=selfBuildApp)

#### 自助发现 AI Agent 的方案

**方案 A：一个应用 = 一个入口（推荐）**

在工作台创建一个"Claw AI 平台"应用，员工点击进入后看到自己可用的 Agent 列表。

```
企微工作台
  └── [Claw AI 平台] 应用图标
        └── H5 页面（平台管理后台的移动端视图）
              ├── 我的 Agent 列表
              ├── 可用空间列表
              ├── /switch 快捷操作
              └── Agent 对话入口
```

优势：统一入口、管理方便、不占工作台多个位置。

**方案 B：一个空间 = 一个应用（高级）**

每个协作空间创建一个独立的企微自建应用，利用可见范围自动控制成员发现：

```
企微工作台
  ├── [工艺助手] → 工艺协作空间（工艺部可见）
  ├── [质检助手] → 质量协作空间（质量部可见）
  └── [我的助手] → 个人空间（所有人可见）
```

优势：部门自然隔离、发现即可用。
劣势：应用数量膨胀、管理复杂度增加。

**建议**：阶段1 用方案 A，阶段2 可探索方案 B。

#### 企微应用入口类型

| 入口           | 说明                   | 适用场景               |
| -------------- | ---------------------- | ---------------------- |
| **工作台应用** | H5 页面或小程序        | 管理后台、Agent 列表   |
| **聊天侧边栏** | 在对话窗口右侧打开应用 | 辅助对话的工具面板     |
| **消息内链接** | 点击消息中的链接进入   | 查看完整报告、详细结果 |
| **应用菜单**   | 应用底部的自定义菜单   | 快捷命令入口           |

### 7.2 部门/标签 API 与自动化空间管理

#### API 能力

| API                     | 说明                 | 自动化用途         |
| ----------------------- | -------------------- | ------------------ |
| `GET /department/list`  | 获取部门列表         | 同步组织架构到平台 |
| `GET /department/get`   | 获取部门详情         | 获取部门负责人     |
| `GET /user/list_id`     | 获取部门成员 ID 列表 | 批量获取部门成员   |
| `GET /user/get`         | 获取成员详情         | 获取职位、角色信息 |
| `POST /tag/create`      | 创建标签             | 创建"空间成员"标签 |
| `POST /tag/addtagusers` | 添加标签成员         | 将用户加入空间标签 |
| 通讯录变更回调          | 成员/部门变更通知    | 实时同步组织变更   |

> 来源：[通讯录管理概述](https://developer.work.weixin.qq.com/document/path/90193)、[企业标签管理](https://developer.work.weixin.qq.com/document/path/96320)

#### 自动化空间成员管理方案

```
组织架构变更（通讯录回调）
    ↓
平台接收变更事件
    ↓
规则引擎匹配
  ├── 员工加入"工艺部" → 自动加入"工艺协作空间"
  ├── 员工离开"工艺部" → 自动移出空间
  ├── 新员工入职 → 自动创建个人空间
  └── 员工离职 → 归档个人空间数据 + 清理
    ↓
更新空间成员表 + 通知相关方
```

#### 部门负责人自助管理

企微 API 支持查询部门负责人（`is_leader_in_dept` 字段），平台可据此实现：

| 自助操作                | 实现方式                                 |
| ----------------------- | ---------------------------------------- |
| 查看空间成员            | 部门负责人 → 对应空间的 viewer 角色      |
| 添加/移除成员           | 负责人通过平台 H5 页面操作，平台同步更新 |
| 查看空间 Agent 使用情况 | 负责人可见空间内 Agent 的使用统计        |
| 审批 Agent 创建请求     | 负责人审批后平台自动创建 Agent           |

**权限模型**：

```
平台管理员 → 全局管理（空间创建/删除、资源配置、系统设置）
部门负责人 → 空间管理（成员增减、Agent 审批、使用统计）
普通成员   → 自助使用（创建 Agent、对话、查看空间资源）
```

**注意**：使用应用 secret 只能进行查询、邀请等**非写操作**，写操作需要通讯录管理 secret。平台需要向企业 IT 申请通讯录管理权限才能实现全自动同步。

> 来源：[基本概念介绍](https://developer.work.weixin.qq.com/document/path/90665)、[部门负责人查询](https://blog.csdn.net/hj1043/article/details/139874373)

### 7.3 制造业 IT 自助化接受度

#### 行业数字化现状（2025）

| 指标                          | 数据                         | 来源             |
| ----------------------------- | ---------------------------- | ---------------- |
| 规上工业企业数字化率          | 77.4%                        | 工信部 2025 数据 |
| 60%+ 企业实现全业务流程数字化 | 研发/生产环节突破 60%        | 新华网报道       |
| 数字化解决方案对工厂重要      | 69% 认为已成为自动化重要部分 | 行业调研         |
| 94% 认为未来更重要            | AI+数字化是趋势              | 行业调研         |

> 来源：[制造业加快数智化转型](https://www.news.cn/tech/20250930/fd239b527fa84b44aec669da6f4eed16/c.html)、[中小企业数字化赋能方案](https://www.gov.cn/zhengce/zhengceku/202412/content_6992542.htm)

#### 自助化接受度分层

| 用户层                       | 自助化接受度 | 习惯模式                   | 平台策略                   |
| ---------------------------- | ------------ | -------------------------- | -------------------------- |
| **IT 管理员**（1-2人）       | 高           | 习惯命令行/后台管理        | 提供 CLI + Web 管理后台    |
| **部门负责人**（工艺主管等） | 中等         | 习惯企微/OA 系统审批流     | 在企微内嵌入审批和管理页面 |
| **工程师**（一线使用者）     | 中-低        | 习惯企微对话，不爱装新 App | **纯对话交互**，零学习成本 |
| **车间操作工**               | 低           | 习惯触屏/扫码操作          | 暂不纳入阶段1 目标用户     |

#### 制造业自助化的关键洞察

1. **"不装新东西"原则**：制造业企业对新系统有天然抵触，企微已有 → 在企微内做一切 = 零部署阻力
2. **"有人兜底"很重要**：纯自助不够，需要 IT 管理员能一键介入；半自助+IT 支持是最佳模式
3. **"渐进式"最被接受**：先让少数技术强的工程师用起来 → 口碑传播 → 部门级推广
4. **"对话即服务"**：对一线工程师来说，给 AI 发条消息比学新系统门槛低 100 倍

#### 对平台自助体验的设计建议

```
自助化分层设计：

Level 0 — 零门槛（所有人）
  在企微里给 Agent 发消息就行，不需要知道"平台"的存在
  → 入口：企微对话窗口

Level 1 — 轻度自助（工程师）
  /agents 看我有什么 Agent、/switch 切换、创建简单 Agent
  → 入口：企微消息命令 + 工作台 H5

Level 2 — 部门管理（负责人）
  查看部门空间使用情况、审批 Agent 请求、管理成员
  → 入口：企微工作台 H5 管理页面

Level 3 — 平台管理（IT 管理员）
  空间创建/配置/监控、系统设置、用户权限
  → 入口：Web 管理后台 + CLI
```

---

## 附录：关键数据源索引

### 企业微信官方文档

- [开发前必读](https://developer.work.weixin.qq.com/document/path/90664)
- [回调配置](https://developer.work.weixin.qq.com/document/path/91116)
- [接收消息概述](https://developer.work.weixin.qq.com/document/path/90238)
- [发送应用消息](https://developer.work.weixin.qq.com/document/path/90236)
- [应用推送消息](https://developer.work.weixin.qq.com/document/path/90248)
- [消息推送配置说明](https://developer.work.weixin.qq.com/document/path/91770)
- [加解密方案说明](https://developer.work.weixin.qq.com/document/path/90968)
- [构造网页授权链接](https://developer.work.weixin.qq.com/document/path/91120)
- [通讯录同步接口](https://developer.work.weixin.qq.com/document/path/96079)
- [通讯录管理概述](https://developer.work.weixin.qq.com/document/path/90193)
- [接入协议概述](https://developer.work.weixin.qq.com/document/path/91366)

### 钉钉开发文档

- [Stream 模式](https://open.dingtalk.com/document/orgapp/stream)
- [自定义机器人接入](https://open.dingtalk.com/document/group/custom-robot-access)
- [开发者百科 - Bot 回复消息](https://open-dingtalk.github.io/developerpedia/docs/learn/bot/appbot/reply/)

### 飞书开发文档

- [Bot 概述](https://open.feishu.cn/document/client-docs/bot-v3/bot-overview?lang=zh-CN)
- [长连接接收事件](https://feishu.apifox.cn/doc-7518429)
- [自定义 Bot 使用指南](https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot?lang=zh-CN)

### 数据合规

- [数据出境安全管理政策问答（2025年4月）](https://www.cac.gov.cn/2025-04/09/c_1745906286623776.htm)
- [企业级 LLM 隐私与安全最佳实践](https://www.weitip.com/news/8605.html)
- [2025 数据合规年度总结](http://www.jingshsz.com/show-19-678-1.html)

### 开源参考项目

- [chatgpt-on-wechat](https://github.com/topics/wechat-bot) — 最成熟的企微 AI Bot
- [Dify-Enterprise-WeChat-bot](https://github.com/luolin-ai/Dify-Enterprise-WeChat-bot) — 企微知识库 Bot
- [corpwechatbot](https://github.com/GentleCP/corpwechatbot) — 企微 Python SDK
- [lingti-bot](https://github.com/ruilisi/lingti-bot) — 多平台统一 Bot
- [WXBizMsgCrypt](https://github.com/fuchengjx/WXBizMsgCrypt) — 企微加解密 TS 库
- [OpenClaw-Wechat](https://github.com/dingxiang-me/OpenClaw-Wechat) — OpenClaw 企微集成插件
