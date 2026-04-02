---
name: ppp-generation-v2
description: >
  Generate industrial-grade Part Production Plans (PPP) and Build Packages for 3D
  printing. Use when user wants to research a 3D printable object, generate printing
  specifications, evaluate printability, or create manufacturing work instructions.
  Triggers on "PPP", "打印方案", "3D打印参数", "调研打印件", "制造工作包",
  "Build Package", or any object the user wants to 3D print. Manages a growing
  knowledge base across sessions.
---

# PPP Generation v2

Generate Part Production Plans through systematic research, knowledge retrieval,
LLM reasoning, and professional report assembly. Optionally extend to a Build
Package with machine-ready specifications and SOPs.

## Project Context

- **Project root**: `/Users/wangym/workspace/agents/printspec`
- **Knowledge base**: `{project}/knowledge/`
- **Output directory**: `{project}/outputs/{product-slug}-{YYYY-MM-DD}/`
- **References**: Read from `references/` in this skill directory as needed

## Two Deliverables

| Deliverable       | Chapters          | Audience                           | Answers                                             |
| ----------------- | ----------------- | ---------------------------------- | --------------------------------------------------- |
| **PPP Report**    | Ch1-11 + App A-C  | R&D engineer, project manager      | What material, process, structure — and why         |
| **Build Package** | Ch12-14 + App D-F | Process engineer, machine operator | Exactly how to set up, print, post-process, inspect |

Build Package **requires** a completed PPP Report as input. It cannot be generated
independently because build parameters depend on material/process/structure decisions.

## Execution Flow

```
Phase 1: Need Gathering        (interactive, 3-8 turns)
Phase 2: Knowledge Retrieval   (read local KB)
Phase 3: Gap Analysis + Research + Images (web search, parallel)
Phase 4: LLM Reasoning         (material → process → parallel decisions)
Phase 4.5: Innovation Analysis  (parameter space exploration)
Phase 5a: PPP Report Assembly   (Ch1-11 + Appendix A-C → HTML → PDF)
Phase 6a: Knowledge Curation    (persist verified data to KB)
── PPP Report complete. User reviews. ──
If Build Package requested:
Phase 4.7: Build Preparation Reasoning  (orientation, supports, layout, coupons)
Phase 4.8: SOP Generation              (step-by-step work instructions)
Phase 5b: Build Package Assembly        (Ch12-14 + Appendix D-F → HTML → PDF)
Phase 6b: Knowledge Curation           (persist equipment/post-proc data)
```

---

## Phase 1: Need Gathering

Ask ONE question per turn. Prefer multiple-choice. Stop after 8 turns max.

### Required fields:

| Field                   | Question pattern                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| **object**              | "你想打印什么？"                                                                            |
| **use_case**            | "用途是什么？a)航空航天 b)工业功能件 c)消费品 d)原型验证"                                   |
| **performance_tier**    | Infer: aerospace / industrial / consumer / prototype                                        |
| **material_preference** | "材料有偏好吗？a)钛合金 b)不锈钢 c)铝合金 d)镍基合金 e)聚合物 f)帮我推荐"                   |
| **batch_size**          | "预计生产多少？a)1-5 原型 b)50-100 小批量 c)1000+ 量产"                                     |
| **depth**               | "需要生成到什么深度？a) PPP Report（调研决策文档）b) PPP + Build Package（含制造执行文档）" |

### Optional fields (ask if relevant):

| Field                | When to ask                                                   |
| -------------------- | ------------------------------------------------------------- |
| **dimensions**       | If user hasn't mentioned size constraints                     |
| **compliance**       | If performance_tier is aerospace/industrial                   |
| **domain_params**    | Category-specific (e.g., USGA for golf, FDA for medical)      |
| **target_equipment** | If depth=b, ask: "有目标设备型号吗？（如 EOS M290、SLM 280）" |

Save as `{output_dir}/product_spec.json`.

---

## Phase 2: Knowledge Retrieval

KB is organized as 4 core libraries + 4 extended libraries.
Read `references/knowledge-schemas.md` for core schemas,
`references/manufacturing-schemas.md` for extended schemas.

```
knowledge/
  materials/       # JSON, one per grade        ← Core
  processes/       # JSON, one per process       ← Core
  dfam_rules/      # JSON, by process            ← Core
  standards/       # JSON, one per standard      ← Core
  equipment/       # JSON, one per machine model ← Extended (Build Package)
  post_processing/ # JSON, by material × process ← Extended (Build Package)
  defects/         # JSON, by process            ← Extended (Build Package)
  test_coupons/    # JSON, by test type          ← Extended (Build Package)
  domain_cache/    # Markdown, by category       ← Shared
  cases/           # Markdown, case studies      ← Shared
  images/          # Reference images by category ← Shared
```

### Retrieval logic:

**Always (PPP Report):**

1. Materials — match by preference; if "帮我推荐", select by application domain first:
   - thermal management → AlSi10Mg, CuCrZr
   - lightweight structural → AlSi10Mg, Ti6Al4V
   - high-temperature → IN718, IN625, CoCrMo
   - biomedical → Ti6Al4V-ELI, CoCrMo
   - Fallback by tier: aerospace→Ti6Al4V,IN718 | industrial→316L,Ti6Al4V | consumer→AlSi10Mg,PA12
2. Processes — compatible with candidate materials
3. DfAM Rules — for candidate processes
4. Standards — material + process + domain standards
5. Domain Cache — reuse if category previously researched
6. Cases — scan for relevant case studies
7. Images — check for cached reference images

**Build Package only (additional):** 8. Equipment — if target_equipment specified, load its parameter set 9. Post-Processing — load heat treatment / machining / surface finishing specs for selected material 10. Defects — load common defects for selected process 11. Test Coupons — load standard coupon geometries

Track what was found vs. missing → feeds Phase 3 gap analysis.

---

## Phase 3: Gap Analysis + Online Research + Image Collection

Read `references/search-tasks.md` for the complete task list with query patterns.

### 3.1 Gap Analysis

Check each chapter against available data. The gap matrix in search-tasks.md maps
chapters to data sources and identifies typical gaps.

### 3.2 Online Research

**Key rules:**

- Prefer `WebSearch` over direct PDF downloads (manufacturer PDFs often 404/522)
- Parallelize independent search tasks (T1-T5 + I1-I3 in one turn)
- T6/T7 (competitor materials) depend on material candidates — run after T1-T3
- Build Package tasks (T8-T13) only if depth=b
- Always search for 1-2 competitor materials for Reasoning Boxes

For each result, record: source URL, data extracted, confidence tier
(standard=1.0, manufacturer=0.95, academic=0.85, industry=0.75, estimate=0.60).

### 3.3 Image Collection

Three-level fallback: curl → Playwright extract → Playwright screenshot → SVG.
Always create `{output_dir}/images/manifest.json`.
Always generate SVG inline diagrams for build orientation and process flow.
See search-tasks.md I1-I3 for image search patterns.

Save research trail as `{output_dir}/research_trail.md`.

---

## Phase 4: LLM Reasoning

### 4.1 Material Selection (serial, MUST be first)

Select evaluation factors by application domain:

- **Universal** (always): density, cost, AM maturity
- **Structural** (mechanical parts): specific strength, modulus, fatigue, elongation
- **Thermal** (heat management): thermal conductivity, CTE, specific heat, operating temp
- **Environmental** (durability): corrosion resistance, biocompatibility

Produce **Reasoning Chain**: question → factors (FACT data + [n] refs) → conclusion →
eliminated options with quantitative comparison against competitors.

### 4.2 Process Selection (depends on 4.1)

Evaluate: precision vs tolerance, surface vs post-proc budget, thin-wall capability,
production validation. Produce Reasoning Chain.

### 4.3 Parallel Decisions (depend on 4.1+4.2, independent of each other)

- Structure design: 2-3 options with pros/cons, recommend one
- Post-processing route: full sequence from as-built to final
- Mechanical validation plan: load cases, test standards, simulation
- Cost estimate: itemized breakdown
- QC plan: witness coupons, NDE, acceptance criteria

---

## Phase 4.5: Innovation Analysis

**Core principle**: Every proposal must be (1) within KB-documented valid ranges,
(2) grounded in physics/metallurgy, (3) actionable in production, (4) with validation plan.

### Parameter Window Optimization

Three-column comparison for each process parameter:

| Parameter | Industry Typical | KB Valid Range | Our Proposal | Rationale | TRL |

Each proposal MUST include: data basis (KB ref), physics reasoning, TRL level,
risk, validation plan, estimated effort.

### Innovation Dimensions

- **Structural**: multi-scale design, cross-domain transfer, self-supporting optimization
- **Material**: alloy variants, gradient microstructure, non-standard heat treatment
- **Cost**: nesting, powder recycling, hybrid manufacturing

### Output

3-5 high-confidence proposals (TRL >= 5) + 2-3 exploratory (TRL 3-4).
Use Innovation Card format defined in `references/report-template.md`.

---

## Phase 5a: PPP Report Assembly

Read `references/report-template.md` for the CSS stylesheet and HTML component patterns
(reasoning box, innovation card, provenance badges, image embedding).

### Mandatory Chapter Structure

**严格按以下编号和标题生成。不可自创章节名或调换顺序。**

| Chapter | Title                                     | Key Content                                                                         |
| ------- | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| Ch1     | Product Overview                          | 物件描述、行业分类、功能需求表、参考案例、适用标准                                  |
| Ch2     | Design Specifications                     | 形态参考、尺寸规格表、重量分布、CAD 设计指导                                        |
| Ch3     | Material Selection                        | 候选材料对比矩阵、推荐材料数据、**Reasoning Box**、合规标准                         |
| Ch4     | Internal Structure Design                 | 结构选项对比、推荐设计参数表、**Reasoning Box**、DfAM 约束、支撑策略                |
| Ch5     | Surface Quality & Post-Processing         | 分区 Ra 目标表、后处理流程图、热处理规格表                                          |
| Ch6     | Print Process                             | 推荐工艺及理由、**Reasoning Box**、关键参数表、构建方向分析、设备推荐、预估打印时间 |
| Ch7     | Mechanical Validation & Simulation        | 关键载荷工况、性能指标表、推荐仿真、测试验证计划                                    |
| Ch8     | Quality Control Plan                      | 原材料检验、过程监控、试件、NDE、验收标准                                           |
| Ch9     | Cost Estimation                           | 成本分解表、批量效应、与传统制造对比                                                |
| Ch10    | Compliance & Standards                    | 适用标准列表、行业合规约束、认证路径、IP 考虑                                       |
| Ch11    | Innovation Proposals & Technology Roadmap | 参数窗口优化表、Innovation Cards (3-5 TRL≥5 + 2-3 TRL 3-4)、短期/中期路线图         |
| App A   | References                                | `[n]` 编号引用列表，含 URL + 数据用途                                               |
| App B   | Research Trail                            | 搜索任务执行记录、KB 覆盖 vs 在线搜索统计、已知数据空白                             |
| App C   | Confidence Notes                          | 每章置信度评分（badge: green≥80% / yellow 70-79% / red <70%）、source tier 权重表   |

### Mandatory CSS & HTML

**必须使用 `references/report-template.md` 中定义的 CSS 样式表**，不可自创样式。
HTML 组件（reasoning box、innovation card、provenance badges）必须使用模板中定义的 class 名。

### Mandatory SVG Diagrams

**无论是否找到网络图片，以下 SVG 图表必须内联生成：**

- **构建方向图** (Ch6): 包围盒 + Z 轴箭头 + 支撑区域标注
- **后处理流程图** (Ch5): 步骤框 + 箭头的流程图
- **结构对比图** (Ch4): 2-3 种结构方案的概念草图并排

### Data Provenance System

Every value in the report MUST be tagged. This is the most important quality rule.

| Tag          | Meaning                             | Allows `[n]`?         | Example                                |
| ------------ | ----------------------------------- | --------------------- | -------------------------------------- |
| **FACT**     | Verified data from KB or web source | Must have             | Ti6Al4V UTS 950 MPa [14]               |
| **CALC**     | Derived from FACT by formula        | Refs input data       | Weight ~800g (vol x density [9])       |
| **ENGR**     | Engineering judgment, no fake refs  | NO fake refs          | Wall 1.5mm (judgment: DfAM min + load) |
| **DECISION** | Selection/recommendation            | Refs supporting facts | Reasoning Box conclusion               |
| **INNOV**    | Innovation proposal within KB range | Refs KB range + TRL   | Zone printing 20/50um [8], TRL-7       |

**Rules:**

1. FACT and CALC are the only types with real `[n]` citations
2. ENGR must honestly mark as `(工程判断)` — never fake a reference
3. DECISION appears in Reasoning Boxes, references FACT data
4. No bare numbers — every value must trace to one of these five types
5. If a value has no source, it's hallucination — delete it or search for data

### Reasoning Boxes

In Ch3 (Material), Ch4 (Structure), Ch6 (Process):
question → factors (FACT + refs) → conclusion (DECISION) → eliminated options.
Every comparison datum must be FACT from competitor material search.

### Confidence Calculation

```
chapter_confidence = weighted_average(section_data_sources)
source_weights: standard=1.0, manufacturer=0.95, academic=0.85,
                industry=0.75, cost_platform=0.65, llm_reasoning=0.60
overall = weighted_average(chapter_confidences)  # Ch3, Ch6 weight 1.5x
```

App C 必须包含每章的 confidence badge 和整体 confidence 评分。

### Output

1. Save as `{output_dir}/report.html` (images use relative paths)
2. Render PDF via Playwright:

```bash
cd {project} && NODE_PATH=/Users/wangym/workspace/agents/cadpilot/frontend/node_modules node -e "
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const htmlPath = path.resolve('{output_dir}/report.html');
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
  await page.pdf({
    path: '{output_dir}/report.pdf',
    format: 'A4',
    margin: { top: '25mm', bottom: '25mm', left: '20mm', right: '20mm' },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div style=\"font-size:8px;color:#666;width:100%;text-align:center\">PrintSpec | Part Production Plan</div>',
    footerTemplate: '<div style=\"font-size:8px;color:#999;width:100%;display:flex;justify-content:space-between;padding:0 20mm\"><span>Confidential</span><span>Page <span class=\"pageNumber\"></span>/<span class=\"totalPages\"></span></span></div>'
  });
  await browser.close();
})();
"
```

---

## Phase 4.7: Build Preparation Reasoning (Build Package only)

Reads PPP Report outputs. Requires: selected material (Ch3), process (Ch6),
structure (Ch4), post-proc route (Ch5), mechanical plan (Ch7).

### Decisions to make:

1. **Build orientation** — precise angle (e.g., "tilt 15° around X, hosel toward Z+"),
   optimize for: surface quality on critical faces, minimize support volume,
   manage thermal stress, respect anisotropy for load path

2. **Support structure design** — type (block/tree/cone), tooth parameters
   (height, top/base length), contact point spacing, fragmentation settings,
   density, removal accessibility

3. **Build plate layout** — parts per plate, inter-part spacing (min 5mm),
   gas flow direction alignment, recoater direction consideration

4. **Slicing parameters** — contour power/speed, infill power/speed,
   downskin/upskin parameters, contour offset, border count

5. **Substrate preparation** — material matching, surface roughness, preheat

6. **Test coupon placement** — geometry per standard, quantity per orientation,
   placement on build plate (corners + center + adjacent to part)

Read `references/manufacturing-schemas.md` for equipment and coupon schemas.

---

## Phase 4.8: SOP Generation (Build Package only)

Generate step-by-step Standard Operating Procedures for each production stage.
Each SOP follows: purpose → scope → equipment/materials → safety → procedure → records.

SOP list:

- D.1 Powder preparation (sieving, drying, blending)
- D.2 Machine setup (gas purge, recoater, substrate, preheat)
- D.3 Build execution (parameter loading, monitoring checkpoints)
- D.4 Part removal (cool-down, depowdering, wire EDM)
- D.5 Support removal (tools, sequence, care areas)
- D.6 Heat treatment (full thermal cycle with ramp rates)
- D.7 Surface finishing (media, pressure, distance, angle)
- D.8 Machining (stock allowance, fixture concept, tool paths)

Read `references/build-package-template.md` for chapter and SOP templates.

---

## Phase 5b: Build Package Assembly (Build Package only)

Read `references/build-package-template.md` for the Ch12-14 + Appendix D-F template.

Output as `{output_dir}/build_package.html` + `build_package.pdf`.
Same PDF rendering method as Phase 5a.

---

## Phase 6: Knowledge Curation

### Curation Rules

| Data type             | Action                 | Condition                                                    |
| --------------------- | ---------------------- | ------------------------------------------------------------ |
| Material properties   | **ALWAYS**             | From manufacturer or ASTM standard                           |
| Process parameters    | **ALWAYS**             | From manufacturer or validated literature                    |
| DfAM rules            | **ALWAYS**             | From manufacturer DfAM guide                                 |
| Standard summaries    | **ALWAYS**             | Key requirements + version, no full text                     |
| Equipment specs       | **ALWAYS**             | From manufacturer datasheet                                  |
| Post-proc parameters  | **ALWAYS**             | Heat treatment cycles, machining specs from validated source |
| Defect data           | **ALWAYS**             | Root cause + prevention from literature                      |
| Test coupon specs     | **ALWAYS**             | From ASTM/ISO test standards                                 |
| Category design specs | **IF high confidence** | Authoritative source for dimensions/compliance/loads         |
| Industry case studies | **IF specific params** | Must have material + process + quantitative results          |
| Reference images      | **IF authoritative**   | Manufacturer press kit or open-access academic               |
| Cost/price data       | **NEVER**              | Volatile                                                     |
| LLM reasoning         | **NEVER**              | Context-dependent                                            |
| News without data     | **NEVER**              | No lasting value                                             |

### Validation Ranges (sanity check before persisting)

```
Ti6Al4V:   UTS 800-1300 MPa, density 4.40-4.45 g/cm3, k 6.7 W/mK
316L:      UTS 500-700 MPa, density 7.95-8.05 g/cm3
IN718:     UTS 1000-1400 MPa, density 8.15-8.25 g/cm3
AlSi10Mg:  UTS 330-480 MPa, density 2.65-2.70 g/cm3, k 100-200 W/mK
CuCrZr:    UTS 300-600 MPa, density 8.85-8.95 g/cm3, k 250-320 W/mK
L-PBF:     layer 20-100 um, energy density 40-120 J/mm3
Powder:    D50 20-50 um, sphericity >= 0.85
```

### Persist Workflow

1. Check if exists → 2. Validate ranges → 3. Write/Update → 4. Log to knowledge_updates.md

---

## Resuming a Previous Session

When user says "基于之前的 XXX PPP, 生成 Build Package":

1. Locate `outputs/{slug}/product_spec.json` and `report.html`
2. Read product_spec.json to recover all decisions
3. Read research_trail.md to see what data is already available
4. Skip Phase 1-5a, go directly to Phase 4.7
5. Run extended KB retrieval (equipment, post-proc, defects, coupons)
6. Run T8-T13 searches if needed
7. Execute Phase 4.7 → 4.8 → 5b → 6b

---

## File Layout

```
outputs/{product-slug}-{YYYY-MM-DD}/
  product_spec.json           # Phase 1 output
  research_trail.md           # Phase 3 research log
  knowledge_updates.md        # Phase 6 curation log
  images/                     # Report images
    manifest.json
    img-01-xxx.jpg
  report.html                 # PPP Report (Ch1-11)
  report.pdf
  build_package.html          # Build Package (Ch12-14) — if requested
  build_package.pdf
```
