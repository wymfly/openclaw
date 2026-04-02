---
name: knowledge-vault
description: >
  个人知识库管理系统。搜索、整理、维护 Obsidian Vault 中的领域知识。
  触发词："knowledge", "知识库", "搜索知识", "搜索", "术语", "学习路径",
  "整理", "整理inbox", "健康检查", "知识状态", "更新概念"。
---

# Knowledge Vault

个人知识库管理 Skill。通过自然语言管理 Obsidian Vault，执行搜索、整理、
术语查询、学习路径生成、健康检查等知识管理操作。

用户是决策者，Skill 是知识管家。用户只需说要做什么，Skill 全权负责 Vault
的创建、维护、分类。任何可能影响已有知识的操作必须先问用户。

---

## Vault 根目录

`~/knowledge-vault/`

如果 Vault 根目录不存在，首次触发时自动执行初始化：

```bash
mkdir -p ~/knowledge-vault/{inbox,concepts,maps,glossary,resources,canvas,archive,templates}
cd ~/knowledge-vault && git init
```

同时创建模板文件（见「模板」章节），然后提交初始化 commit。

---

## 工具选择策略（降级机制）

本 Skill 优先使用 obsidian-cli 与运行中的 Obsidian 交互，获取更丰富的能力。
当 Obsidian 未启动时，自动降级到文件系统工具。

### 检测方法

每次触发 Skill 时，先执行检测：

```bash
obsidian search query="test" limit=1 2>&1
```

- 命令成功 → `OBSIDIAN_AVAILABLE=true`，使用 obsidian-cli
- 命令失败 → `OBSIDIAN_AVAILABLE=false`，降级到 Read/Write/Grep/Glob

### 能力对照表

| 操作     | Obsidian 可用时                                     | 降级方案                   |
| -------- | --------------------------------------------------- | -------------------------- |
| 搜索     | `obsidian search query="X"`                         | Grep + Glob                |
| 读取笔记 | `obsidian read file="X"`                            | Read 工具                  |
| 创建笔记 | `obsidian create name="X" content="..." silent`     | Write 工具                 |
| 追加内容 | `obsidian append file="X" content="..."`            | Edit 工具                  |
| 反向链接 | `obsidian backlinks file="X"`                       | Grep 搜索 `\[\[X\]\]`      |
| 标签统计 | `obsidian tags sort=count counts`                   | Grep 统计 frontmatter tags |
| 属性修改 | `obsidian property:set name="X" value="Y" file="Z"` | Edit 修改 frontmatter      |

### 写入操作说明

创建和修改文件**始终使用 Write/Edit 工具**（不依赖 Obsidian 运行状态），确保写入可靠。
obsidian-cli 主要用于**读取和查询类操作**（搜索、backlinks、tags、read）。

---

## Vault 结构

```
~/knowledge-vault/
├── inbox/          # 调研报告落地区（maturity: seed）
├── concepts/       # 核心知识（按领域子目录，maturity: growing|mature）
│   ├── manufacturing/
│   ├── materials/
│   ├── software/
│   └── ...         # 按需创建
├── maps/           # MOC 知识地图（MOC-{领域}.md）
├── glossary/       # 术语表（按领域一个文件，Markdown 表格）
├── resources/      # 学习资源索引
├── canvas/         # Obsidian Canvas 可视化
├── archive/        # 归档区（只进不出）
└── templates/      # 笔记模板
    ├── tpl-concept.md
    └── tpl-glossary.md
```

---

## Frontmatter 标准（概念笔记）

concepts/ 下的每个 .md 文件必须包含以下 frontmatter：

```yaml
---
type: concept
domain: { 领域名 }
maturity: seed | growing | mature
confidence: high | medium | low
decay_rate: fast | slow | stable
created: YYYY-MM-DD
updated: YYYY-MM-DD
aliases: []
supersedes: []
superseded_by: []
tags: []
---
```

| 字段          | 说明                                                                 |
| ------------- | -------------------------------------------------------------------- |
| maturity      | seed=刚创建, growing=有实质内容, mature=经过验证和补充               |
| confidence    | 对内容准确性的信心等级                                               |
| decay_rate    | 知识衰减速度。fast=技术前沿/版本敏感, slow=基础理论, stable=物理定律 |
| aliases       | 别名列表，用于搜索匹配                                               |
| supersedes    | 此笔记取代的旧笔记路径                                               |
| superseded_by | 此笔记被哪个新笔记取代                                               |

---

## 模板

### tpl-concept.md

```markdown
---
type: concept
domain: { domain }
maturity: seed
confidence: medium
decay_rate: slow
created: { date }
updated: { date }
aliases: []
supersedes: []
superseded_by: []
tags: []
---

# {概念名称}

## 定义

{一句话定义}

## 核心要点

- {要点 1}
- {要点 2}
- {要点 3}

## 详细说明

{展开描述}

## 相关概念

- [[{相关概念 1}]]
- [[{相关概念 2}]]

## 来源

- {来源引用}
```

### tpl-glossary.md

```markdown
---
type: glossary
domain: { domain }
updated: { date }
---

# {领域名} 术语表

| 术语   | 英文      | 定义   | 相关概念   |
| ------ | --------- | ------ | ---------- |
| {术语} | {English} | {定义} | [[{概念}]] |
```

---

╔══════════════════════════════════════════╗
║ 安全规则（不可违反） ║
╠══════════════════════════════════════════╣
║ 1. 永远不删除任何文件 ║
║ 2. 修改 concepts/ 已有文件需用户确认 ║
║ 3. 归档 = 移入 archive/ + superseded_by ║
║ 4. inbox/ 追加不需确认（低风险） ║
║ 5. glossary/ 追加新术语不需确认 ║
║ 6. MOC 链接只加不减 ║
║ 7. 新建领域子目录不需确认 ║
║ 8. 批量操作前展示预览等确认 ║
║ 9. 所有写操作完成后用 git 自动 commit ║
╚══════════════════════════════════════════╝

---

## Git 自动提交

每次写操作（创建文件、修改文件、移动文件）完成后，自动执行：

```bash
cd ~/knowledge-vault && git add -A && git commit -m "{操作描述}"
```

操作描述示例：

- `feat(concept): add FDM.md to concepts/manufacturing/`
- `feat(glossary): add 3 terms to glossary/manufacturing.md`
- `feat(map): create MOC-manufacturing.md`
- `chore(inbox): organize 2 reports, create 5 concept notes`
- `feat(concept): update SLM.md content and maturity`

---

## 七种操作模式

### 模式 1：搜索

**触发词：** "搜索 X", "search X", "知识库里有没有 X", "查 X"

**流程：**

**当 OBSIDIAN_AVAILABLE=true：**

1. 使用 `obsidian search query="X" limit=20` 搜索全 Vault
2. 用 `obsidian backlinks file="X"` 获取相关联的笔记（如果搜到了精确匹配的概念）
3. 按来源目录分类结果（concepts > glossary > inbox）

**当 OBSIDIAN_AVAILABLE=false（降级）：**

1. 用 Glob 搜索 `~/knowledge-vault/concepts/**/*.md` 和 `~/knowledge-vault/glossary/*.md`
   的文件名匹配（模糊匹配关键词）
2. 用 Grep 在 `~/knowledge-vault/concepts/` 和 `~/knowledge-vault/glossary/` 中搜索
   文件内容，包括 frontmatter 的 `aliases` 字段
3. 也搜索 `~/knowledge-vault/inbox/`，但结果标注为 `[未整理]`

**两种模式都执行：**

4. 合并结果，按相关度排序：
   - 概念笔记（concepts/）优先级最高
   - 术语表（glossary/）次之
   - inbox 文件最低
5. 展示结果格式：

```
搜索结果：X
═══════════
1. [[FDM.md]] (concepts/manufacturing/) — maturity: mature
   > 熔融沉积成型，通过逐层挤出热塑性丝材构建三维物体...

2. glossary/manufacturing.md — 术语匹配
   > FDM | Fused Deposition Modeling | 最常见的桌面级 3D 打印技术

3. [[fdm-research.md]] (inbox/) — [未整理]
   > 调研报告，包含 FDM 工艺参数对比...

未找到结果时：知识库中未找到与 "X" 相关的内容。
```

---

### 模式 2：整理 inbox

**触发词：** "整理 inbox", "整理", "处理 inbox"

**流程：**

1. 用 Glob 列出 `~/knowledge-vault/inbox/*.md`（排除 .gitkeep）
2. 如果为空 → 回复 "inbox 为空，没有待整理的报告。"
3. 逐一处理每份报告：

   a. 用 Read 读取报告全文

   b. 从报告中提取 3-5 个核心概念（候选原子笔记）

   c. 对每个概念，判断建议归属的领域子目录（`concepts/{domain}/`）

   d. 提取关键术语列表（候选 glossary 条目）

   e. 对每个概念，用 Grep 检查 `concepts/` 中是否已存在同名或相似笔记
   - 已存在 → 标注为 `[已有，建议更新]`
   - 不存在 → 标注为 `[新建]`

   f. 展示给用户：

   ```
   报告 [xxx.md] 分析结果：

   核心概念：
   1. FDM — 熔融沉积成型 → concepts/manufacturing/ [新建]
   2. Layer Height — 层高 → concepts/manufacturing/ [新建]
   3. SLM — 选择性激光熔化 → concepts/manufacturing/ [已有，建议更新]

   术语候选：
   - FDM (Fused Deposition Modeling)
   - SLM (Selective Laser Melting)
   - Infill Density (填充密度)

   是否处理？[全部创建 / 选择性创建 / 跳过此报告]
   ```

   g. 用户确认后：
   - 创建领域子目录（如果不存在）：`mkdir -p ~/knowledge-vault/concepts/{domain}/`
   - 为每个确认的概念生成笔记：
     - 基于 `templates/tpl-concept.md` 模板
     - 填入从报告中提取的实际内容
     - maturity 设为 `growing`
     - domain 设为对应领域
     - created/updated 设为当天日期
   - 对标注 `[已有，建议更新]` 的概念：
     - 展示现有内容和新内容差异
     - 用户确认后合并更新（遵循安全规则 2）
   - 检查 `maps/` 是否有对应领域的 MOC（`MOC-{domain}.md`）：
     - 有 → 追加新概念的 `[[wikilink]]` 到对应分支
     - 无 → 创建新 MOC，包含已有 + 新增概念链接
   - 新术语追加到 `glossary/{domain}.md`：
     - 文件不存在 → 基于 `templates/tpl-glossary.md` 创建
     - 文件已存在 → 追加新行到表格末尾（不重复添加）

4. 所有报告处理完后汇总：

```
整理完成
════════
已处理报告：N 份
新建概念笔记：M 条
更新已有概念：K 条
新增术语：L 条
MOC 更新：P 个
```

5. Git commit：`chore(inbox): organize N reports, create M concepts`

---

### 模式 3：术语查询/添加

**触发词：** "术语 X", "X 是什么意思", "解释 X", "什么是 X"

**流程：**

1. 用 Grep 在 `~/knowledge-vault/glossary/` 所有 .md 文件中搜索术语（大小写不敏感）
2. 同时在 `~/knowledge-vault/concepts/` 中搜索同名概念笔记

3. **找到术语 →** 展示定义和相关概念：

```
术语：X
══════
定义：{定义内容}
领域：{domain}
相关概念：[[{概念1}]], [[{概念2}]]
```

4. **没找到 →** 提示用户：

```
未找到术语 "X"。要我帮你添加吗？
需要告诉我它属于哪个领域（如 manufacturing, materials, software 等）。
```

5. 用户确认后：
   - LLM 生成术语定义（一句话，精确）
   - 追加到对应领域的 `glossary/{domain}.md` 表格末尾
   - 如果 glossary 文件不存在，基于模板创建
   - Git commit：`feat(glossary): add term "{X}" to {domain}`

---

### 模式 4：学习路径

**触发词：** "学习路径 X", "知识树 X", "我要学 X", "学习 X"

**流程：**

1. 检查 `~/knowledge-vault/maps/MOC-{X}.md` 是否存在

2. **存在 →** 读取并展示现有 MOC：

```
已有知识地图：MOC-{X}
════════════════════
{MOC 内容摘要}

需要扩展这个知识地图吗？
```

3. **不存在 →** LLM 生成知识树：
   - 6-8 个主干分支
   - 每个主干 5-8 个知识点
   - P0/P1/P2 优先级标注
   - 知识点间依赖关系标注（用箭头或缩进表示）

4. 展示给用户确认：

```
为 "{X}" 生成的知识树：
═══════════════════════

## 1. 基础理论 (P0)
- 概念 A (P0) ← 入门必读
- 概念 B (P0) ← 依赖 A
- 概念 C (P1)

## 2. 核心技术 (P0)
- 概念 D (P0) ← 依赖 1.A, 1.B
- 概念 E (P1)
...

确认创建此知识地图？
```

5. 用户确认后创建 `maps/MOC-{X}.md`：
   - 已有概念笔记用 `[[wikilink]]` 链接
   - 未创建的概念标注为 `(待研究)`
   - 包含优先级和依赖关系
   - Git commit：`feat(map): create MOC-{X}.md with N branches`

---

### 模式 5：健康检查

**触发词：** "健康检查", "知识库状态", "检查过期", "vault 健康"

**流程：**

**当 OBSIDIAN_AVAILABLE=true（增强模式）：**

1. 使用 `obsidian tags sort=count counts` 获取全 Vault 标签统计
2. 对每个概念笔记使用 `obsidian backlinks file="X"` 检测孤立笔记（零反向链接）
3. 使用 `obsidian search query="maturity: seed"` 快速定位 seed 状态笔记
4. 孤立笔记加入报告的「需要关注」区域，建议添加到 MOC 或建立关联

**当 OBSIDIAN_AVAILABLE=false（降级）：**

1. 用 Glob 扫描 `~/knowledge-vault/concepts/**/*.md` 所有概念笔记
2. 用 Grep 读取每个文件的 frontmatter YAML 块（提取 maturity, confidence,
   decay_rate, updated 字段）

**两种模式都执行：**

3. 统计 `~/knowledge-vault/glossary/` 术语条目数（Grep 统计表格行数）
4. 统计 `~/knowledge-vault/maps/` MOC 数量
5. 统计 `~/knowledge-vault/inbox/` 积压文件

6. 按规则标记需要 review 的笔记：
   - `decay_rate: fast` + `updated` 距今超过 6 个月
   - `decay_rate: slow` + `updated` 距今超过 12 个月
   - `confidence: low`（任何时候都需要关注）
   - `maturity: seed` 且文件创建超过 30 天

7. 输出报告（只报告，不自动修改）：

```
知识库健康报告
═══════════════

概念笔记：XX 条（mature: X, growing: X, seed: X）
术语条目：XX 条
MOC 地图：XX 个
inbox 积压：XX 份（其中 X 份超过 30 天）

领域分布：
- manufacturing: XX 条
- materials: XX 条
- software: XX 条

需要更新的笔记：
- [[SLM.md]] — decay_rate: fast, 距上次更新 8 个月
- [[PLA.md]] — confidence: low
- [[draft-research.md]] — inbox 中停留 45 天

孤立笔记（无反向链接，仅 Obsidian 开启时检测）：
- [[PETG.md]] — 未被任何 MOC 或其他概念引用

标签热度（仅 Obsidian 开启时）：
- #3d-printing: 12 次
- #additive-manufacturing: 8 次
- #thermoplastic: 4 次

建议：先更新 [[SLM.md]]，可以说 "更新 SLM"
```

---

### 模式 6：更新概念

**触发词：** "更新 X", "刷新 X", "update X"

**流程：**

1. 用 Glob + Grep 在 `~/knowledge-vault/concepts/` 中搜索对应笔记
   （文件名匹配 + aliases 匹配）

2. **没找到 →** 回复：

```
未找到概念 "X"。
- 要创建新概念笔记吗？
- 要先搜索一下知识库吗？（说 "搜索 X"）
```

3. **找到 →** 读取并展示当前内容和元数据：

```
当前概念：[[X.md]]
═══════════════════
路径：concepts/{domain}/X.md
maturity: growing
confidence: medium
updated: 2025-08-15（距今 7 个月）
decay_rate: fast

当前内容摘要：
{首段 + 核心要点}

要对这个概念重新调研并更新吗？
```

4. 用户确认后：
   - 如果用户提供了新内容 → 直接更新笔记内容（需用户确认最终版本）
   - 如果用户说"帮我调研" → 提示用户使用 domain-research skill 调研，
     调研结果会落入 inbox/，然后通过 "整理 inbox" 流程更新
   - 更新 frontmatter 的 `updated` 为当天日期
   - 根据内容丰富度调整 `maturity`（seed → growing → mature）
   - Git commit：`feat(concept): update {X}.md content and metadata`

---

### 模式 7：状态总览

**触发词：** "知识状态", "vault 状态", "状态", "status"

**流程：**

1. 统计各目录文件数量：

```bash
# concepts/ 按领域子目录统计
# glossary/ 统计文件数和总术语数
# maps/ 统计 MOC 数量
# inbox/ 统计待处理文件
# archive/ 统计归档文件
```

2. 统计 maturity 分布（Grep 扫描 concepts/ 所有 frontmatter）

3. 列出最近 5 条修改的笔记（按文件修改时间排序）

4. 列出所有领域及其概念数量

5. 输出：

```
Knowledge Vault 状态总览
═══════════════════════════

目录统计：
  concepts/    XX 条概念笔记
  glossary/    XX 个领域术语表（共 XX 条术语）
  maps/        XX 个知识地图
  inbox/       XX 份待整理
  archive/     XX 份已归档
  resources/   XX 条学习资源

Maturity 分布：
  mature:  XX (XX%)
  growing: XX (XX%)
  seed:    XX (XX%)

领域分布：
  manufacturing: XX 条
  materials:     XX 条
  software:      XX 条
  ...

最近修改：
  1. concepts/manufacturing/FDM.md — 2026-03-05
  2. glossary/materials.md — 2026-03-04
  3. concepts/materials/Ti6Al4V.md — 2026-03-03
  4. maps/MOC-manufacturing.md — 2026-03-02
  5. inbox/new-research.md — 2026-03-01
```

---

## 跨模式协作

各模式之间的联动关系：

- **搜索** 发现 inbox 内容 → 建议用户 **整理 inbox**
- **整理 inbox** 发现已有概念 → 进入 **更新概念** 流程（需确认）
- **健康检查** 发现过期笔记 → 建议用户 **更新概念**
- **更新概念** 需要调研 → 引导用户使用 domain-research skill → 结果落入 inbox
- **学习路径** 发现知识空白 → 标注 `(待研究)`，用户可逐个触发 domain-research
- **术语查询** 发现相关概念笔记 → 展示链接

---

## 文件命名规范

| 类型     | 命名规则                              | 示例                         |
| -------- | ------------------------------------- | ---------------------------- |
| 概念笔记 | `{概念名}.md`（英文优先，短横线分词） | `selective-laser-melting.md` |
| 术语表   | `{domain}.md`                         | `manufacturing.md`           |
| MOC      | `MOC-{领域}.md`                       | `MOC-manufacturing.md`       |
| 归档     | 保持原名，移入 `archive/`             | `archive/old-note.md`        |

概念笔记文件名使用英文小写短横线分词。中文名称放入 frontmatter 的 `aliases` 和
正文标题中。
