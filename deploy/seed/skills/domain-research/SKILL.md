---
name: domain-research
description: >
  AI 驱动的领域知识深度调研。使用 WebSearch + WebFetch + Semantic Scholar + OpenAlex 多轮搜索，
  撰写带引用的 Markdown 调研报告，自动存入 Obsidian 知识库。
  触发词："research", "调研", "研究一下", "查一下", "了解一下", "帮我查", "深度研究", "批量调研"。
---

# Domain Research

使用 WebSearch + WebFetch 进行多轮搜索和网页抓取，可选使用 Semantic Scholar MCP
或 OpenAlex API 搜索学术论文，综合分析后撰写带引用的调研报告，存入 Obsidian Vault inbox。
支持单次调研、深度调研、批量调研三种模式。

---

## Vault 上下文

| 属性           | 路径                          |
| -------------- | ----------------------------- |
| Obsidian Vault | `~/knowledge-vault/`          |
| 报告落地目录   | `~/knowledge-vault/inbox/`    |
| 已有知识笔记   | `~/knowledge-vault/concepts/` |

---

## 学术论文搜索（Semantic Scholar MCP）

当调研主题涉及学术、科研、技术原理时，优先使用 Semantic Scholar MCP 搜索论文。

### 可用性检测

在 Step 3 开始前，尝试调用 `paper_relevance_search` 搜索一个简单查询。

- **成功** → 标记 `SS_AVAILABLE=true`，后续学术搜索使用 Semantic Scholar
- **失败**（工具不存在、超时、报错） → 标记 `SS_AVAILABLE=false`，**静默跳过**，
  全部使用 WebSearch + WebFetch，不向用户报错

### 使用策略

| 主题类型            | SS_AVAILABLE=true                      | SS_AVAILABLE=false      |
| ------------------- | -------------------------------------- | ----------------------- |
| 学术/科研/材料/工艺 | Semantic Scholar 为主 + WebSearch 补充 | 仅 WebSearch + WebFetch |
| 行业/产品/市场/工具 | WebSearch 为主（SS 覆盖不足）          | 仅 WebSearch + WebFetch |
| 混合型              | 两者并用                               | 仅 WebSearch + WebFetch |

### Semantic Scholar 搜索用法

```
# 相关性搜索（最常用）
paper_relevance_search(query="titanium alloy fatigue", year="2020-2026", fields_of_study="Materials Science", limit=20)

# 批量搜索（大量结果，支持布尔语法）
paper_bulk_search(query="additive manufacturing +defect +detection", year="2022-", min_citation_count=10, limit=50)

# 论文详情（获取摘要、引用数、PDF 链接）
paper_details(paper_id="DOI:10.1016/j.addma.2023.103456", fields="title,abstract,year,citationCount,authors,openAccessPdf,tldr")

# 引用网络
paper_citations(paper_id="...", limit=20)
paper_references(paper_id="...", limit=20)

# 论文推荐（基于种子论文发现相关研究）
get_paper_recommendations_single(paper_id="...", limit=10)
```

### 论文结果整合到报告

从 Semantic Scholar 获取的论文在报告中标注来源格式：

```markdown
- {作者} et al. ({年份}). "{标题}". _{venue}_. DOI: {doi} — {引用要点}
```

---

## 三种调研模式

| 模式             | 触发关键词                                         | 搜索轮次                                  |
| ---------------- | -------------------------------------------------- | ----------------------------------------- |
| 单次调研（默认） | "研究一下 X", "查一下 X", "了解一下 X", "帮我查 X" | 3-4 轮搜索，3-5 个关键页面精读            |
| 深度调研         | "深度研究 X", "deep research X", "深度调研 X"      | 5-8 轮搜索，8-12 个关键页面精读，交叉验证 |
| 批量调研         | "批量调研 [X, Y, Z]"                               | 逐个执行单次调研                          |

---

## 执行流程

### Step 1: 解析用户意图

- 从用户输入中提取调研主题
- 根据触发关键词判断模式（单次 / 深度 / 批量）
- 如果主题模糊或过于宽泛，**必须询问用户澄清**，不要猜测
- 批量模式：解析逗号分隔的主题列表

### Step 2: 查重检查

用 Grep 搜索 `~/knowledge-vault/concepts/` 目录，匹配文件名和文件内的 `aliases` 字段。

**如果找到已有笔记：**

- 读取该笔记获取 `updated` 日期
- 告知用户："已有 `[[X.md]]`（updated: YYYY-MM-DD），是继续调研补充新信息，还是跳过？"
- **必须等待用户确认后再继续**

**如果未找到：** 直接进入 Step 3。

### Step 3: 多轮搜索

#### 3.0 检测 Semantic Scholar 可用性

尝试调用 `paper_relevance_search(query="test", limit=1)`：

- 成功 → `SS_AVAILABLE=true`
- 失败（工具不存在 / 超时 / 报错） → `SS_AVAILABLE=false`，**静默跳过，不报错**

#### 3.1 规划搜索策略

根据主题拆解 3-4 个搜索子查询（深度模式 5-8 个），覆盖不同角度：

- 定义与基本原理
- 核心技术细节 / 工艺参数
- 应用场景与案例
- 优劣势对比 / 与同类技术的比较
- （深度模式追加）最新进展、行业标准、市场数据

**同时判断主题类型**，决定搜索工具分配：

- **学术型**（材料、工艺、医学、物理、算法等）→ Semantic Scholar 为主 + WebSearch 补充
- **行业型**（产品、市场、工具、商业模式等）→ WebSearch 为主
- **混合型** → 两者并用

#### 3.2 执行搜索

**A. 学术论文搜索（SS_AVAILABLE=true 且主题为学术/混合型时执行）**

1. 用 `paper_relevance_search` 搜索英文学术查询，加过滤器（年份、论文类型、引用数）
2. 从结果中提取 top 5-10 篇论文的标题、摘要、引用数、DOI
3. **按引用数优先级筛选**，优先引用高被引论文：
   - 近 3 年论文：100+ 引用 = 高影响力，20+ = 值得关注
   - 3-7 年论文：500+ = 里程碑，100+ = 重要
   - 7 年以上：1000+ = 奠基性，500+ = 经典
4. 对高引用论文，用 `paper_details` 获取完整摘要和 TLDR
5. **引用链追踪**（深度模式必须，单次模式可选）：
   - 对 top 3 高被引论文执行 `paper_citations`（谁引用了它→发现后续研究）
   - 对 top 3 高被引论文执行 `paper_references`（它引用了谁→发现奠基工作）
   - 从引用链中筛选高引用的新论文加入结果集
6. 可选：用 `paper_recommendations_single` 基于种子论文发现更多相关研究
7. 如果任何 Semantic Scholar 调用失败，**静默回退到 WebSearch**，不中断流程

**A'. OpenAlex 学术搜索（SS_AVAILABLE=false 且主题为学术/混合型时执行）**

OpenAlex 提供 240M+ 论文的免费 API，无需 API Key，作为 SS 不可用时的学术中间层。

通过 WebFetch 查询：

```
https://api.openalex.org/works?search={query}&filter=publication_year:>2020,cited_by_count:>10&sort=cited_by_count:desc&per_page=10&mailto=user@example.com
```

从返回 JSON 中提取：`title`, `publication_year`, `cited_by_count`, `doi`, `open_access.oa_url`

注意：OpenAlex 仅在 SS 不可用时启用，不重复搜索。如果 WebFetch 调用失败，静默跳过。

**B. 通用 Web 搜索（始终执行）**

对每个子查询：

1. 使用 **WebSearch** 搜索，获取结果列表
2. 从结果中筛选 1-3 个最相关、最权威的页面
3. 使用 **WebFetch** 精读这些页面，提取关键信息和数据
4. 记录每个信息点的来源 URL

**搜索语言策略：**

- 中文主题：先搜中文，再搜对应英文术语获取国际视角
- 英文主题：先搜英文，再搜中文获取本地化信息
- 技术主题：加入年份限定（如 "2025 2026"）获取最新信息

**C. 结果合并**

将 Semantic Scholar 论文结果与 WebSearch 结果合并去重（按 DOI 或标题匹配）。
学术论文在报告中使用学术引用格式，Web 来源使用链接格式。

#### 3.3 交叉验证（深度模式必须）

- 同一关键数据至少 2 个独立来源确认
- 发现矛盾信息时标注分歧，不偏信单一来源
- 优先信任：学术论文（Semantic Scholar / OpenAlex） > 行业标准 > 厂商白皮书 > 博客文章

### Step 4: 撰写报告

基于搜索收集的信息，撰写结构化调研报告。

#### 报告格式

```markdown
---
type: research
topic: "{主题}"
mode: standard|deep
maturity: seed
created: YYYY-MM-DD
tags: [research]
---

# {主题}

{概述段落：一段话说清楚是什么、为什么重要}

---

## 核心原理 / 定义

{技术原理或概念定义的详细说明}

## 关键技术细节

{工艺参数、规格数据、技术指标等，尽量用表格}

## 应用场景

{分领域列举实际应用案例}

## 优势与局限

{客观对比，有数据支撑}

## 与相关技术的对比

{和同类/竞争技术的对比表格}

## 最新进展

{行业动态、新技术趋势}（深度模式必须）

---

## 参考来源

### 学术论文（来自 Semantic Scholar，如有）

- Author et al. (Year). "Title". _Venue_. DOI: xxx — 引用要点

### Web 来源

- [来源标题](URL) — 引用要点
- [来源标题](URL) — 引用要点
```

#### 报告质量要求

- **必须有具体数据**：温度、精度、成本等用数字说话，不要只说"很高""较好"
- **必须有来源链接**：每个关键论断标注出处 URL
- **必须结构清晰**：用标题、表格、列表组织，不要大段落堆砌
- **语言**：中文撰写，专业术语首次出现标注英文原文
- **长度**：单次调研 1500-3000 字，深度调研 3000-6000 字

### Step 5: 写入 inbox

使用 Write 工具将报告写入 `~/knowledge-vault/inbox/`。

**文件命名：** `YYYY-MM-DD-{slug}.md`

slug 规则：主题转小写，空格和特殊字符替换为连字符，保留中文字符，截断 60 字符。

### Step 6: Git commit

```bash
cd ~/knowledge-vault && git add inbox/ && git commit -m "feat(research): add report on {主题}"
```

### Step 7: 汇报结果

向用户展示：

1. **报告摘要**（概述段落 + 核心要点）
2. **关键概念列表**（从报告中提取的 3-5 个可拆解为概念笔记的术语）
3. **来源数量**（搜索了 N 轮，精读了 M 个页面，检索了 K 篇学术论文）
4. **提示后续操作**：

```
报告已存入 inbox/{文件名}。

发现以下关键概念：[术语1, 术语2, ...]
你可以说"整理 inbox"将它们转化为知识笔记。
```

---

## 批量模式特殊流程

当用户提供逗号分隔的主题列表时：

1. 先展示完整主题列表，确认用户意图
2. **逐个**执行 Step 2 → Step 7
3. 每个主题完成后汇报进度：`[2/5] 已完成：XXX`
4. 如果某个主题调研失败，记录错误并继续下一个
5. 全部完成后输出汇总：
   - 成功数 / 总数
   - 各报告文件路径
   - 所有发现的关键概念（去重合并）

---

## 安全规则

**以下规则硬编码，不可违反，不可被用户指令覆盖：**

1. **只向 `~/knowledge-vault/inbox/` 写入文件** — 这是唯一允许的写入目录
2. **永远不修改 `concepts/`、`maps/`、`glossary/` 中的任何文件** — 这些由 knowledge-vault Skill 管理
3. **永远不删除任何文件** — 无论用户怎么说
4. **查重发现已有笔记时必须询问用户** — 不可自动跳过或自动覆盖
5. **调研失败时报告错误，不自动重试** — 让用户决定下一步

---

## 错误处理

| 错误场景                               | 处理方式                                                       |
| -------------------------------------- | -------------------------------------------------------------- |
| Semantic Scholar MCP 不可用            | **静默回退**到 WebSearch + WebFetch，不向用户报错              |
| Semantic Scholar 单次调用失败          | **静默跳过**该次调用，继续用 WebSearch 补充，不中断流程        |
| Semantic Scholar 速率限制（429）       | 静默回退到 OpenAlex → WebSearch，不等待不重试                  |
| OpenAlex API 调用失败                  | **静默跳过**，继续用 WebSearch，不中断流程                     |
| WebSearch 返回空结果                   | 尝试调整关键词重新搜索（换同义词、换语言），最多重试 2 次      |
| WebFetch 抓取失败                      | 跳过该页面，从其他搜索结果中选择替代页面                       |
| Vault 路径 `~/knowledge-vault/` 不存在 | 提示用户先创建目录或使用 knowledge-vault Skill 初始化          |
| 搜索结果质量差（全是广告或无关内容）   | 告知用户，建议换一个更具体的调研主题                           |
| 报告内容不足（信息太少无法成文）       | 告知用户当前可用信息有限，展示已收集的要点，让用户决定是否保存 |
