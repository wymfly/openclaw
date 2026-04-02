# PPP Report Template

## Report Structure (10 Chapters + 3 Appendices)

### Cover Page

- PrintSpec logo + subtitle
- Product name (中英文)
- "Part Production Plan"
- Metadata table: Report ID, Performance Tier, Date, Version, Classification
- Overall Confidence score with visual bar

### Table of Contents

- All chapters and key sections listed

### Chapter 1: 产品概述 (Product Overview)

- 1.1 物件描述与用途
- 1.2 行业分类
- 1.3 功能需求摘要 (table: 需求 / 描述 / 来源[n])
- 1.4 参考案例 (table + **case study images**: AM-produced product photos with captions and [n] citations)
- 1.5 适用标准概览 (table: 标准 / 范围 / 来源[n])

### Chapter 2: 设计规格 (Design Specifications)

- 2.1 外形参考与典型变体 (table + **product reference images** with captions)
- 2.2 尺寸规格 (table: 参数 / 规范值 / 来源[n])
- 2.3 重量分布 (table: 组件 / 典型重量 / 占比 / 来源[n])
- 2.4 CAD 设计要点

### Chapter 3: 材料方案 (Material Selection)

- 3.1 候选材料对比矩阵 (table with [n] citations per column header)
- 3.2 推荐材料详细数据表 (chemical composition, mechanical props, powder spec)
- 3.3 **选型推理逻辑** ← REASONING BOX (purple highlight)
  - Question: "为什么选择 X 而非其他候选材料？"
  - Numbered factors with quantitative analysis + [n] refs
  - 淘汰理由 for each rejected candidate
- 3.4 合规标准

### Chapter 4: 内部结构设计 (Internal Structure)

- 4.1 结构方案对比 (2-3 options table)
- 4.2 推荐方案详述 (parameter table with [n] refs + **structure visualization images/SVG**)
- 4.3 **设计决策推理** ← REASONING BOX
- 4.4 最小特征尺寸约束 (table: 特征 / 最小值 / 来源[n])
- 4.5 支撑结构策略

### Chapter 5: 表面质量与后处理 (Surface & Post-Processing)

- 5.1 各区域表面质量要求 (table: 区域 / 目标Ra / 打印态Ra / 后处理方式 / 来源[n])
- 5.2 后处理工艺路线图 (flow-box, monospace)
- 5.3 热处理规范 (table: 工序 / 温度 / 压力 / 时间 / 气氛 / 标准[n])

### Chapter 6: 打印工艺方案 (Print Process)

- 6.1 推荐打印技术及理由
- 6.2 **工艺选型推理** ← REASONING BOX
- 6.3 关键工艺参数 (table: 参数 / 推荐值 / 可用范围 / 来源[n])
- 6.4 构建方向分析 (table with badges + **build orientation SVG diagram**)
- 6.5 设备选型建议 (table)
- 6.6 预计打印时间 (table)

### Chapter 7: 力学验证与仿真建议 (Mechanical Validation)

- 7.1 关键载荷工况 (table with [n] refs)
- 7.2 关键性能指标 (table: 指标 / 目标值 / 测试标准)
- 7.3 建议仿真类型 (table)
- 7.4 试验验证计划 (ordered list)

### Chapter 8: 质量控制计划 (Quality Control Plan)

- 8.1 原材料检验 (table: 检验项 / 方法 / 验收标准 / 频率 / 来源[n])
- 8.2 过程监控 (table)
- 8.3 见证试件 (table)
- 8.4 无损检测 NDE (table)
- 8.5 验收标准汇总 (table with [n] refs)

### Chapter 9: 成本估算 (Cost Estimation)

- 9.1 成本明细 (table: 项目 / 成本 / 占比 / 备注 / 来源[n])
- 9.2 批量效应 (table)
- 9.3 与传统工艺对比 (table)
- Note box: cost conclusion

### Chapter 10: 合规与标准 (Compliance & Standards)

- 10.1 适用标准清单 (table with [n] refs)
- 10.2 行业合规约束 (table if applicable)
- 10.3 认证路径建议 (ordered list)
- 10.4 知识产权提示

### Appendix A: 参考文献 (References)

Numbered list, each entry:

```
[n] Title
    Source Organization
    URL (full, clickable)
    Data used: what specific data was extracted from this source
```

### Appendix B: 调研轨迹 (Research Trail)

- B.1 调研任务清单 (table: # / 查询 / 目的 / 目标章节 / 结果)
- B.2 知识库命中 vs 在线调研 (table with badges: KB / Search / LLM)
- B.3 已知数据缺口 (bullet list)

### Appendix C: 置信度说明 (Confidence Notes)

- Per-chapter confidence table (badges: green ≥80%, yellow 70-79%, red <70%)
- Source tier weight table

---

## HTML Styling Guide

Use the CSS from the v2 report (`ppp-report-v2.html`) as the baseline. Key classes:

| Class                      | Usage                                                 |
| -------------------------- | ----------------------------------------------------- |
| `.cover`                   | Cover page container                                  |
| `.toc`                     | Table of contents                                     |
| `.chapter`                 | Each chapter (page-break-before)                      |
| `.appendix`                | Each appendix (page-break-before)                     |
| `.reasoning`               | Purple reasoning box (border-left: 3px solid #9c27b0) |
| `.reasoning-title`         | Bold purple title in reasoning box                    |
| `.note`                    | Yellow callout box                                    |
| `.cite`                    | Superscript citation link [n]                         |
| `.badge-green/yellow/blue` | Colored badges                                        |
| `.flow-box`                | Monospace process flow                                |
| `.ref-list`                | References table styling                              |
| `.recommend`               | Green highlight for recommended cells                 |

## Confidence Calculation

```
chapter_confidence = weighted_average(section_data_sources)

source_weights = {
  "standard": 1.00,      # ASTM, USGA, NASA, ISO
  "manufacturer": 0.95,  # EOS, SLM Solutions, Renishaw datasheets
  "academic": 0.85,      # ScienceDirect, Springer, MDPI papers
  "industry_case": 0.75, # 3D Printing Industry, TCT, manufacturer case studies
  "cost_platform": 0.65, # Xometry, MakerVerse, Protolabs
  "llm_reasoning": 0.60, # LLM inference, estimation
}

overall_confidence = weighted_average(chapter_confidences)
# Ch3 (material) and Ch6 (process) have 1.5x weight
```
