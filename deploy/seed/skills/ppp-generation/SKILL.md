---
name: ppp-generation
description: >
  Generate industrial-grade Part Production Plans (PPP) for 3D printing through
  systematic research, knowledge retrieval, and LLM reasoning. Use this skill whenever
  the user wants to research a 3D printable object, generate a PPP report, create a
  printing specification, or evaluate printability of a product. Also trigger when user
  says "调研打印件", "生成PPP", "打印方案", "3D打印参数", "可打印报告",
  "PrintSpec", or describes any object they want to 3D print and needs manufacturing
  parameters for. This skill manages a persistent knowledge base that grows with each
  research session.
---

# PPP Generation Skill

Generate a complete Part Production Plan by researching the target object, retrieving
knowledge, filling gaps through online research, reasoning about optimal parameters,
and assembling a professional cited report with reference images.

## Project Context

- **Project root**: `/Users/wangym/workspace/agents/printspec`
- **Knowledge base**: `{project}/knowledge/`
- **Output directory**: `{project}/outputs/{product-slug}-{YYYY-MM-DD}/`
- **Report template**: Read `references/report-template.md` in this skill directory
- **Knowledge schemas**: Read `references/knowledge-schemas.md` in this skill directory

## Execution Flow

The PPP generation follows 6 phases. Each phase's output feeds the next.
Phases 1-2 are fast; Phase 3 is the bottleneck (web search + image search);
Phase 4-6 are LLM-heavy.

```
Phase 1: Need Gathering      (interactive, 3-8 turns)
Phase 2: Knowledge Retrieval  (read local KB, <5s)
Phase 3: Gap Analysis + Online Research + Image Collection (web search, 30-60s)
Phase 4: LLM Reasoning       (material/process/structure decisions)
Phase 4.5: Innovation Analysis (parameter space exploration + production-grade proposals)
Phase 5: Report Assembly      (11-chapter PPP with citations + images)
Phase 6: Knowledge Curation   (decide what to persist, incl. reference images)
```

---

## Phase 1: Need Gathering

Collect enough information to define the ProductSpec. Ask ONE question per turn.
Prefer multiple-choice when possible. Stop after 8 turns max — use reasonable
defaults for anything unclear.

### Required fields (must collect):

| Field                   | Question pattern                                                   | Example    |
| ----------------------- | ------------------------------------------------------------------ | ---------- |
| **object**              | "你想打印什么？"                                                   | 高尔夫球头 |
| **use_case**            | "用途是什么？a)比赛级 b)原型验证 c)展示模型 d)功能测试"            | 比赛级     |
| **performance_tier**    | Infer from use_case: aerospace / industrial / consumer / prototype | industrial |
| **material_preference** | "材料有偏好吗？a)金属-钛 b)金属-钢 c)金属-铝 d)聚合物 e)帮我推荐"  | 金属-钛    |
| **batch_size**          | "预计生产多少？a)1-5 原型 b)50-100 小批量 c)1000+ 量产"            | 小批量     |

### Optional fields (ask if relevant):

| Field                | When to ask                                                                           |
| -------------------- | ------------------------------------------------------------------------------------- |
| **dimensions**       | If user hasn't mentioned size constraints                                             |
| **compliance**       | If performance_tier is aerospace/industrial                                           |
| **domain_params**    | Category-specific (e.g., USGA rules for golf, FDA for medical)                        |
| **reference_images** | "有参考图片或 CAD 截图吗？（可选，没有我会搜索参考图）" — ask after confirming object |

### Output: ProductSpec

Save as `{output_dir}/product_spec.json`:

```json
{
  "object": "高尔夫球头",
  "category": "运动器材/高尔夫/球杆/一号木球头",
  "use_case": "比赛级球杆",
  "performance_tier": "industrial",
  "material_preference": "metal/titanium",
  "batch_size": "small_batch",
  "dimensions": { "volume_cc": 460, "weight_g_max": 200 },
  "compliance": ["USGA", "R&A"],
  "domain_params": {},
  "reference_images": []
}
```

---

## Phase 2: Knowledge Retrieval

Read local knowledge base files. The KB is organized as:

```
knowledge/
  materials/       # JSON files, one per material grade
  processes/       # JSON files, one per process type
  dfam_rules/      # JSON files, grouped by process
  standards/       # JSON files, one per standard
  domain_cache/    # Markdown files, one per product category researched before
  cases/           # Markdown files, industry case studies
  images/          # Reference images organized by category
    {category-slug}/   # e.g., heat-exchanger/, golf-driver/
```

### Retrieval logic:

1. **Materials**: Read all JSON files in `knowledge/materials/` that match
   the material preference. If preference is "帮我推荐", read all files and
   select candidates by **application domain first, then performance_tier**:

   Application domain mapping (takes priority over tier):
   - thermal management → AlSi10Mg, CuCrZr, Cu
   - lightweight structural → AlSi10Mg, Ti6Al4V
   - corrosion-resistant → 316L, IN625, Ti6Al4V
   - high-temperature → IN718, IN625, CoCrMo
   - biomedical → Ti6Al4V-ELI, CoCrMo, 316L

   Fallback by performance_tier (if no domain match):
   - aerospace → Ti6Al4V, IN718
   - industrial → Ti6Al4V, 316L, AlSi10Mg, 17-4PH
   - consumer → AlSi10Mg, 316L, PA12
   - prototype → PA12, resin, PLA

2. **Processes**: Read JSON files in `knowledge/processes/` for compatible
   processes (check `compatible_materials` field).

3. **DfAM Rules**: Read `knowledge/dfam_rules/{process}.json` for each
   candidate process.

4. **Standards**: Read relevant standard summaries from `knowledge/standards/`.

5. **Domain Cache**: Check if `knowledge/domain_cache/{category-slug}.md`
   exists. If yes, this category was researched before — reuse the data.

6. **Cases**: Scan `knowledge/cases/` for relevant case studies.

7. **Images**: Check if `knowledge/images/{category-slug}/` exists.
   If yes, reuse cached reference images. Future: use image vector
   similarity search across all stored case images.

### Output:

Track what was found vs. what's missing. This feeds the gap analysis.

---

## Phase 3: Gap Analysis + Online Research + Image Collection

### 3.1 Gap Analysis

For each chapter, check if you have sufficient data:

| Chapter              | Needs (source)                                                                         | Typically missing                                       |
| -------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Ch1 Product Overview | category desc [KB], cases [KB or SEARCH], standards [KB]                               | Cases for new categories                                |
| Ch2 Design Specs     | dimensions [SEARCH], geometry [SEARCH], compliance [KB], **reference images [SEARCH]** | Category-specific dimensions almost always need search  |
| Ch3 Material         | properties [KB], comparison [KB], powder spec [KB], **competitor materials [SEARCH]**  | Competitor material comparison for reasoning            |
| Ch4 Structure        | design options [LLM], wall thickness [KB+SEARCH], DfAM [KB]                            | Category-specific structure needs LLM reasoning         |
| Ch5 Surface & Post   | Ra targets [KB], post-process route [KB], heat treatment [KB]                          | Category-specific surface needs may need search         |
| Ch6 Print Process    | parameters [KB], equipment [KB], time [CALC]                                           | Usually well-covered                                    |
| Ch7 Mechanical       | load cases [SEARCH+LLM], performance targets [KB], sim suggestions [LLM]               | Category-specific loads always need search or reasoning |
| Ch8 QC               | QC template [KB], inspection standards [KB]                                            | Usually well-covered                                    |
| Ch9 Cost             | powder price [SEARCH], print cost [CALC], post cost [KB+CALC]                          | Prices need fresh data                                  |
| Ch10 Compliance      | standards list [KB], regulations [KB or SEARCH]                                        | Industry-specific regulations may need search           |

### 3.2 Online Research

For each gap, execute a targeted web search. Use `WebSearch` or `WebFetch` tools.

**Important**: Prefer `WebSearch` for data extraction. Do NOT rely on direct PDF
downloads (`WebFetch` on .pdf URLs) — manufacturer PDFs (EOS, SLM Solutions)
frequently return 404/522. Instead, search for the data indirectly via web pages
that cite the datasheet values.

**Search domain mapping** — restrict searches to authoritative sites:

```
material_data:     eos.info, slm-solutions.com, renishaw.com, matweb.com
process_params:    eos.info, slm-solutions.com, sciencedirect.com
industry_cases:    3dprintingindustry.com, tctmagazine.com, additivemanufacturing.media
cost_estimation:   xometry.com, protolabs.com, makerverse.com
standards:         astm.org, iso.org, standards.nasa.gov
domain_specific:   varies by category (e.g., usga.org for golf, fda.gov for medical)
```

**Parallelization**: T1-T5 and I1-I3 are independent — launch them as parallel
`WebSearch` calls in a single tool-use turn to minimize total research time.
T6/T7 depend on material candidates identified in T2/T3, so run them after.

**Search task template**:

| Task | Query pattern                                                           | Purpose                                                       |
| ---- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| T1   | "{object} specifications dimensions standards"                          | Compliance + sizing                                           |
| T2   | "3D printed {object} case study additive manufacturing"                 | Industry cases                                                |
| T3   | "{object} internal structure design {material}"                         | Structure reference                                           |
| T4   | "{object} loading conditions forces impact fatigue"                     | Mechanical data                                               |
| T5   | "{material} powder price per kg {year}"                                 | Cost data                                                     |
| T6   | "{competitor_material} vs {primary_material} {key_property} comparison" | Competitor material comparison — critical for reasoning boxes |
| T7   | "{competitor_material_2} {process} properties"                          | Second competitor data if needed                              |

**Why T6/T7 matter**: The reasoning boxes in Ch3/Ch4/Ch6 require quantitative
comparison against eliminated candidates. Without competitor data, the reasoning
is qualitative and unconvincing. Always search for at least 1-2 competitor materials.

For each search result, extract structured data and record:

- **source URL** (exact page)
- **data extracted** (what specific numbers/facts)
- **confidence tier** (standard=1.0, manufacturer=0.95, academic=0.85, industry=0.75, estimate=0.60)

### 3.3 Image Collection

Search for reference images of the target object and related AM case studies.
Images serve three purposes: (1) help the reader understand the target object,
(2) show internal structure / build orientation concepts, (3) provide AM case
study visuals.

**Image search tasks**:

| Task | Query pattern                                | Purpose                          | Target chapter |
| ---- | -------------------------------------------- | -------------------------------- | -------------- |
| I1   | "{object} 3D printed additive manufacturing" | AM-produced product photo        | Ch1, Ch2       |
| I2   | "{structure_type} {object} cross section"    | Internal structure visualization | Ch4            |
| I3   | "3D printed {object} {material} case study"  | Case study photos                | Ch1            |

**Image handling workflow (three-level fallback)**:

1. Use `WebSearch` with image-related queries to find relevant images
2. From search results, extract **case study page URLs** (not direct image URLs)
   from authoritative sources (manufacturer websites, academic papers, industry media)

3. **Level 1: curl direct download** (fast, try first)

   ```bash
   mkdir -p {output_dir}/images
   curl -L -o {output_dir}/images/{filename} "{image_url}" \
     --connect-timeout 10 --max-time 30 -s -w "%{http_code}"
   ```

   If HTTP 200 → success. If 403/404/429 → go to Level 2.

4. **Level 2: Playwright page extraction** (handles anti-hotlinking, dynamic loading)
   When curl fails, use Playwright MCP tools to open the source page and extract images:

   ```
   browser_navigate → open the case study page URL
   browser_snapshot → locate target <img> elements by selector
   browser_evaluate → extract actual image src:
     document.querySelector('img.target-selector').src
   ```

   Then download the extracted real URL with curl (adding referer header):

   ```bash
   curl -L -o {output_dir}/images/{filename} "{real_img_url}" \
     -H "Referer: {page_url}" --connect-timeout 10 --max-time 30
   ```

5. **Level 3: Playwright screenshot** (last resort for protected images)
   If Level 2 also fails, screenshot the relevant page region:

   ```
   browser_navigate → open the page
   browser_take_screenshot → capture the image area
   ```

   Save the screenshot as the reference image. Note in manifest that
   this is a screenshot, not the original image file.

6. **Fallback: SVG + manifest record**
   If all levels fail, record the URL in manifest.json with
   `"download_status": "failed"` and use SVG inline diagrams in the report.

7. **Always create `{output_dir}/images/manifest.json`** — record all URLs found,
   download status, and method used (curl/playwright-extract/playwright-screenshot/failed).

8. Embed images in HTML: downloaded images use relative paths (`images/filename.jpg`);
   failed images reference source URL with `<img src="https://...">`.

9. Record image source + license info in the reference list

**Image source priority** (prefer in this order):

1. User-provided images (highest priority, always use)
2. Manufacturer case study images (EOS, SLM Solutions, Conflux etc.)
3. Open-access academic paper figures (Creative Commons)
4. Industry media (3DPrintingIndustry, TCT — check license)
5. SVG diagrams generated inline (for structural concepts, flow charts)

**SVG inline diagrams** — always generate these regardless of web image availability:

- Build orientation diagram (Ch6): simple box with arrow showing Z direction
- Post-processing flow chart (Ch5): replace text flow-box with SVG
- Structure comparison diagram (Ch4): side-by-side concept sketches

**Image metadata format** (save as `{output_dir}/images/manifest.json`):

```json
[
  {
    "id": "img-01",
    "filename": "gyroid-heat-exchanger.jpg",
    "source_url": "https://...",
    "source_org": "Conflux Technology",
    "caption": "Gyroid TPMS 液冷散热器成品（Conflux Technology）",
    "license": "manufacturer press kit",
    "used_in_chapters": [1, 4],
    "ref_id": 2
  }
]
```

Save the research trail as `{output_dir}/research_trail.md`.

---

## Phase 4: LLM Reasoning

### 4.1 Material Selection (MUST be first — others depend on it)

Evaluate candidates on these factors, with explicit quantitative comparison.
The factor list depends on the application domain — pick the relevant subset:

**Universal factors** (always evaluate):

- **Density** → weight budget impact (calculate: volume x density)
- **Cost** (powder price x estimated mass)
- **AM maturity** (how many vendors have validated parameters)

**Structural factors** (when mechanical performance matters):

- **Specific strength** (UTS / density)
- **Elastic modulus** → functional behavior
- **Fatigue life** → durability
- **Elongation** → ductility requirements

**Thermal factors** (when heat transfer matters — heat exchangers, cold plates,
thermal management, electronics enclosures):

- **Thermal conductivity** → THE deciding factor for heat transfer parts
- **CTE** → thermal cycling compatibility with mating components
- **Specific heat** → transient thermal response
- **Operating temperature range**

**Environmental factors** (when durability matters):

- **Corrosion resistance** → maintenance, fluid compatibility
- **Biocompatibility** → medical applications

Produce a **Reasoning Chain**: state the question, list factors with data and sources,
give the conclusion, and list eliminated options with reasons. The reasoning MUST
include quantitative data from competitor materials (searched in Phase 3 T6/T7).

### 4.2 Process Selection (depends on 4.1)

Evaluate candidate processes against the selected material:

- **Precision** vs. part tolerance requirements
- **Surface quality** vs. post-processing budget
- **Thin-wall capability** vs. minimum feature size
- **Production validation** (any existing case studies?)

Produce a Reasoning Chain.

### 4.3 Parallel Decisions (depend on 4.1 + 4.2, independent of each other)

- **Structure design**: 2-3 options with pros/cons, recommend one with reasoning
- **Post-processing route**: full sequence from as-built to final part
- **Mechanical validation plan**: load cases, test standards, simulation suggestions
- **Cost estimate**: itemized breakdown (material + print + heat treat + CNC + QC)
- **QC plan**: witness coupons, NDE methods, acceptance criteria

---

## Phase 4.5: Innovation Analysis

The goal of this phase is to move beyond "industry replication" to **production-grade
innovation**. Web-searched cases often reflect conservative, mainstream practice — not
the frontier. The KB contains full parameter ranges, not just typical values. Use this
parameter space to reason about better combinations.

**Core principle**: Every innovation proposal must be (1) within KB-documented valid
ranges, (2) grounded in physics/metallurgy reasoning, (3) actionable in production
(not theoretical), and (4) accompanied by a concrete validation plan.

### 4.5.1 Parameter Window Optimization

For each selected process parameter, produce a three-column comparison:

| Parameter       | Industry Typical    | KB Valid Range | Our Proposal                                       | Rationale                                            | TRL |
| --------------- | ------------------- | -------------- | -------------------------------------------------- | ---------------------------------------------------- | --- |
| Layer thickness | 30 μm               | 20-60 μm [KB]  | Critical surfaces 20μm / bulk 50μm (zone printing) | Precision where needed + 35% time reduction          | 7   |
| Scan strategy   | Stripe 67° rotation | Multiple [KB]  | Checkerboard + island random offset                | Reduces residual stress concentration                | 8   |
| HIP temperature | 920°C               | 910-930°C [KB] | 915°C (low end)                                    | Suppresses grain coarsening, retains higher strength | 6   |

Each proposal MUST include:

- **Data basis**: Which KB field and range supports this (with [n] reference)
- **Physics/metallurgy reasoning**: WHY this change improves the outcome
- **TRL level**: 9=production-proven, 7=demonstrated, 5=validated in lab, 3=theoretical
- **Risk**: What could go wrong
- **Validation plan**: Specific test specimens, quantities, and acceptance criteria
- **Estimated effort**: Time and cost to validate

### 4.5.2 Structural Innovation

Go beyond the "standard" structure found via web search. Consider:

- **Multi-scale design** — Macro topology optimization + meso functionally-graded lattice
  - micro surface texture. Each scale addresses a different performance objective.
- **Cross-domain transfer** — Patterns proven in one domain applied to another
  (e.g., medical trabecular bone structure → aerospace lightweight fill;
  heat exchanger TPMS → structural damping).
- **Self-supporting optimization** — Integrate DfAM constraints (overhang angle from KB)
  directly into the topology optimization objective. Less support = lower cost + less
  post-processing. Quantify the savings.
- **Functionally graded density** — Variable-density lattice: dense at load paths,
  sparse elsewhere. Use KB min-wall and min-feature constraints as lower bounds.

### 4.5.3 Material Innovation

- **Alloy variant evaluation** — Compare the selected material against advanced variants
  using KB data (e.g., Ti6Al4V vs Ti6Al4V-ELI vs Ti5553 for higher β-phase strength).
  Only propose variants that have KB or searched data for AM processability.
- **Gradient microstructure** — Same alloy, different scan parameters in different zones
  to achieve varied grain structure (e.g., fine grain at fatigue-critical surfaces,
  coarser grain in bulk for ductility). Cite KB process parameter ranges.
- **Non-standard heat treatment** — Explore post-processing routes beyond the industry
  standard (e.g., duplex anneal, sub-β-transus HIP, direct aging). Cite KB thermal
  property data and published research if available.

### 4.5.4 Cost Innovation

- **Nesting optimization** — Multiple parts per build plate, powder utilization improvement.
  Calculate savings based on KB build volume and part dimensions.
- **Powder recycling strategy** — KB records max reuse cycles. Propose optimal
  recycling scheme that maximizes powder utilization within quality limits.
- **Hybrid manufacturing** — Identify if DED near-net-shape + L-PBF fine features
  would reduce cost for this specific geometry. Only propose if both processes
  are in KB with compatible material data.

### 4.5.5 Output Format

Each innovation proposal follows this structure in the report (Ch11):

```html
<div class="innovation-card">
  <div class="innovation-title">创新建议 #N: [Title]</div>
  <table>
    <tr>
      <td>行业现状</td>
      <td>[What industry typically does]</td>
    </tr>
    <tr>
      <td>我们的方案</td>
      <td>[Our specific proposal]</td>
    </tr>
    <tr>
      <td>预期改善</td>
      <td>[Quantitative improvement estimate]</td>
    </tr>
    <tr>
      <td>数据依据</td>
      <td>INNOV: [KB references] + [physics reasoning]</td>
    </tr>
    <tr>
      <td>TRL</td>
      <td>[3-9] — [description]</td>
    </tr>
    <tr>
      <td>风险</td>
      <td>[What could go wrong]</td>
    </tr>
    <tr>
      <td>验证方案</td>
      <td>[Specimens, tests, acceptance criteria]</td>
    </tr>
    <tr>
      <td>投入估算</td>
      <td>[Time + cost to validate]</td>
    </tr>
  </table>
</div>
```

Innovation proposals should be ranked by **impact × feasibility** (TRL ≥ 5 first,
then TRL 3-4 as "future exploration"). Aim for 3-5 high-confidence proposals
and 2-3 exploratory ones per report.

**CSS for Innovation Cards** (add to report `<style>`):

```css
.innovation-card {
  background: #e8eaf6;
  border-left: 4px solid #3f51b5;
  padding: 14px 16px;
  margin: 14px 0;
  border-radius: 0 6px 6px 0;
}
.innovation-title {
  color: #283593;
  font-weight: 700;
  font-size: 11pt;
  margin-bottom: 8px;
}
.innovation-card table td:first-child {
  font-weight: 600;
  width: 100px;
  color: #3f51b5;
}
```

---

## Phase 5: Report Assembly

Generate a 10-chapter PPP report with:

### Data Provenance System (数据溯源)

Every numerical value, parameter, or claim in the report MUST be tagged with one
of four source types. This is the most important quality rule of the entire PPP.

**The four source types:**

| Tag          | 含义                                      | 允许 `[n]` 引用？              | 示例                                                  |
| ------------ | ----------------------------------------- | ------------------------------ | ----------------------------------------------------- |
| **FACT**     | 来自 KB 或 WebSearch 的硬数据             | ✅ 必须有                      | Ti6Al4V UTS 950-1050 MPa [14]                         |
| **CALC**     | 由 FACT 计算推导，公式可追溯              | ✅ 引用输入数据                | 重量 ~800g（体积×密度 [9]）                           |
| **ENGR**     | 工程判断：LLM 基于领域知识 + 多个事实综合 | ❌ 禁止伪引用                  | 壁厚 1.5-2.0mm (工程判断: DfAM 最小 0.4mm + 承压需求) |
| **DECISION** | 选型/推荐/方案决策，纯 LLM 推理           | ✅ 引用支撑事实                | Reasoning Box 中的结论                                |
| **INNOV**    | 基于 KB 参数范围推理的创新建议            | ✅ 引用 KB 范围数据 + 标注 TRL | 分区变层厚: 关键面 20μm/体区 50μm [8], TRL-7          |

**核心规则：**

1. **FACT 和 CALC 是唯一允许出现 `[n]` 引用的数据类型。** `[n]` 表示该数值
   直接来自或可追溯到该引用。
2. **ENGR 必须诚实标注为 `(工程判断)`**，不允许挂一个似是而非的引用来伪装权威性。
   ENGR 值在表格来源列标注 `工程判断` 并简述依据。
3. **DECISION 出现在 Reasoning Box 中**，其推理过程引用 FACT 数据，但结论本身是推理。
4. **禁止裸数值**：报告中每个具体数字都必须能追溯到上述四类之一。
   如果一个数值既不在 KB 中、也没搜到、也不是计算结果、也不是工程判断，
   那它就是 LLM 幻觉——**删除它或搜索补充数据**。

**各章节典型来源分布：**

```
Ch1  产品概述     → 主要 FACT（标准分类、案例数据）
Ch2  设计规格     → FACT（尺寸）+ ENGR（壁厚、公差等设计参数）
Ch3  材料方案     → FACT（属性表）+ DECISION（选型推理）
Ch4  内部结构     → FACT（孔径、孔隙率文献值）+ ENGR（设计参数）+ DECISION（结构选型）
Ch5  表面与后处理 → FACT（Ra 值、热处理参数）+ ENGR（工艺路线编排）
Ch6  打印工艺     → FACT（工艺参数）+ DECISION（工艺选型）+ ENGR（构建方向）
Ch7  力学验证     → FACT（载荷数据）+ ENGR（操作条件、测试指标）+ CALC（应力计算）
Ch8  质量控制     → FACT（标准要求）+ ENGR（检测方案、频率）
Ch9  成本估算     → FACT（粉末价格）+ CALC（成本计算）+ ENGR（工时估算）
Ch10 合规标准     → FACT（标准清单）
Ch11 创新建议     → INNOV（参数优化、结构创新、材料创新、成本创新）+ FACT（KB 范围数据）
```

**HTML 中的标注格式：**

- FACT: 直接用 `<a class="cite" href="#refN">[N]</a>`
- CALC: 用 `<a class="cite" href="#refN">[N]</a>` 并在旁注明 "计算"
- ENGR: 在表格来源列写 `<span class="badge badge-yellow">工程判断</span>`，
  可加 tooltip 或括号说明依据
- DECISION: 在 Reasoning Box 内，引用支撑 FACT
- INNOV: 在 Innovation Card 内，用 `<span class="badge badge-purple">INNOV TRL-N</span>`，
  引用 KB 参数范围数据，标注 TRL 等级

### Reasoning Boxes

In Ch3 (Material), Ch4 (Structure), and Ch6 (Process), include a
**Reasoning Box** that explains WHY the recommendation was made.
Format: question → factors (with FACT data + source refs) → conclusion → eliminated options.
Reasoning Box 中的每个定量对比数据必须是 FACT，结论本身是 DECISION。

### Image Embedding

Embed collected images in the HTML report at these locations:

- **Ch1 (1.4 参考案例)**: AM case study photos, showing real printed parts
- **Ch2 (2.1 外形参考)**: Product reference images, typical variants
- **Ch4 (4.2 推荐方案详述)**: Internal structure visualization (web image + SVG)
- **Ch6 (6.4 构建方向)**: Build orientation SVG diagram

Image HTML pattern:

```html
<figure style="text-align:center;margin:16px 0;">
  <img
    src="images/filename.jpg"
    alt="description"
    style="max-width:100%;max-height:300px;border-radius:4px;border:1px solid #e0e0e0;"
  />
  <figcaption style="font-size:8.5pt;color:#666;margin-top:6px;">
    图 N: Caption text <a class="cite" href="#refN">[N]</a>
  </figcaption>
</figure>
```

For SVG inline diagrams, embed directly in HTML (no external file needed).

### Report Structure

Read `references/report-template.md` for the chapter template.
Key points:

- Cover page with confidence score
- Table of contents
- 11 chapters with inline [n] citations and embedded images:
  - Ch1-Ch10: Standard PPP chapters (product, design, material, structure,
    surface, process, mechanical, QC, cost, compliance)
  - **Ch11: 创新建议与技术路线图** (Innovation Proposals & Roadmap)
    - 3-5 high-confidence Innovation Cards (TRL ≥ 5)
    - 2-3 exploratory proposals (TRL 3-4)
    - Technology roadmap: short-term (can implement now) vs medium-term (need validation)
    - Each card uses the format defined in Phase 4.5.5
- Appendix A: References (with URLs)
- Appendix B: Research Trail (search queries, KB vs Search vs LLM breakdown)
- Appendix C: Confidence Notes (per-chapter, with source tier weights)

### Output Format

1. Save report as `{output_dir}/report.html` (styled HTML for PDF, images use relative paths)
2. **You MUST attempt PDF rendering** — do not skip or defer to the user.
   If Playwright execution fails, log the error in research_trail.md but still try.
   Render PDF using Playwright:

```bash
cd {project} && NODE_PATH=/Users/wangym/workspace/agents/cadpilot/frontend/node_modules node -e "
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const htmlPath = '{output_dir}/report.html';
  const html = fs.readFileSync(htmlPath, 'utf8');
  // Use file:// URL so relative image paths resolve correctly
  await page.goto('file://' + path.resolve(htmlPath), { waitUntil: 'networkidle' });
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

Note: Use `page.goto('file://...')` instead of `page.setContent()` so that
relative image paths (`images/xxx.jpg`) resolve correctly against the HTML file location.

---

## Phase 6: Knowledge Curation

After completing the report, decide what new knowledge to persist. This is critical
for the knowledge base to grow over time.

### Curation Rules

| Data type                                | Action                                   | Condition                                                          | Storage                                     |
| ---------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------- |
| Material mechanical properties           | **ALWAYS persist**                       | From manufacturer datasheet or ASTM standard                       | `knowledge/materials/{grade}.json`          |
| Process parameters (power, speed, layer) | **ALWAYS persist**                       | From manufacturer or validated literature                          | `knowledge/processes/{process}.json`        |
| DfAM rules (min wall, overhang, gap)     | **ALWAYS persist**                       | From manufacturer DfAM guide                                       | `knowledge/dfam_rules/{process}.json`       |
| Standard summaries (ASTM, NASA, etc.)    | **ALWAYS persist**                       | Key requirements + version number only, no full text               | `knowledge/standards/{standard-code}.json`  |
| Category-specific design specs           | **PERSIST if high confidence**           | Dimensions, compliance rules, load cases from authoritative source | `knowledge/domain_cache/{category-slug}.md` |
| Industry case studies                    | **PERSIST if contains specific params**  | Must have material + process + quantitative results                | `knowledge/cases/{case-slug}.md`            |
| Reference images                         | **PERSIST if from authoritative source** | Manufacturer/academic images with clear provenance                 | `knowledge/images/{category-slug}/`         |
| Cost/price data                          | **DO NOT persist**                       | Volatile, search every time                                        | --                                          |
| LLM reasoning conclusions                | **DO NOT persist**                       | Context-dependent, not transferable                                | --                                          |
| News articles without data               | **DO NOT persist**                       | No lasting value                                                   | --                                          |

### Image Curation

When persisting reference images to `knowledge/images/{category-slug}/`:

1. Only persist images from manufacturer press kits or open-access academic papers
2. Save the image file + update `knowledge/images/{category-slug}/manifest.json`
3. Manifest entry includes: filename, source_url, source_org, caption, license, tags
4. Tags enable future image vector similarity search (e.g., ["gyroid", "TPMS", "heat-exchanger", "AlSi10Mg"])

Future: An image embedding model will index all images in `knowledge/images/` for
vector similarity retrieval. Tags serve as a bridge until vector search is implemented.

### Persist Workflow

For each item to persist:

1. **Check if exists**: Read the target file, see if data is already there
2. **Validate**: Cross-check values against known ranges (see validation rules below)
3. **Write/Update**: Use the schemas defined in `references/knowledge-schemas.md`
4. **Log**: Append to `{output_dir}/knowledge_updates.md` what was added/updated and why

### Validation Rules (sanity checks)

```
Ti6Al4V:   UTS 800-1300 MPa, density 4.40-4.45 g/cm3
316L:      UTS 500-700 MPa, density 7.95-8.05 g/cm3
IN718:     UTS 1000-1400 MPa, density 8.15-8.25 g/cm3
AlSi10Mg:  UTS 330-480 MPa, density 2.65-2.70 g/cm3, k 100-200 W/m·K
CuCrZr:    UTS 300-600 MPa, density 8.85-8.95 g/cm3, k 250-320 W/m·K
L-PBF:     layer thickness 20-100 um, energy density 40-120 J/mm3
Powder:    D50 20-50 um, sphericity >= 0.85
```

---

## Iteration & Learning

Each time you complete a PPP generation, note what went well and what didn't
at the bottom of `{output_dir}/research_trail.md` under a "## Lessons Learned"
section. Topics to reflect on:

- Which KB data was useful vs. which searches were needed?
- Were any search queries ineffective? What would work better?
- Were there reasoning errors in the initial draft?
- What knowledge should have been in the KB but wasn't?
- Were reference images found? Quality sufficient for the report?
- Did competitor material data strengthen or weaken the reasoning?

These notes inform future skill improvements.

---

## Quick Reference: File Layout

```
printspec/
  knowledge/
    materials/Ti6Al4V.json        # ~30 params per material
    materials/AlSi10Mg.json
    materials/316L.json
    processes/L-PBF.json          # process params + compatible materials
    processes/EBM.json
    dfam_rules/L-PBF.json         # min wall, overhang angle, etc.
    standards/ASTM-F2924.json     # key requirements summary
    standards/ASTM-F3318.json
    standards/NASA-STD-6030.json
    domain_cache/golf-driver.md   # cached category research
    domain_cache/heat-exchanger.md
    cases/farsoon-golf.md         # case study with specific params
    images/                       # reference images by category
      golf-driver/
        manifest.json
        farsoon-spider-web.jpg
      heat-exchanger/
        manifest.json
        conflux-gyroid.jpg
  outputs/
    golf-driver-2026-03-06/
      product_spec.json
      research_trail.md
      knowledge_updates.md
      report.html
      report.pdf
      images/                     # report-specific images
        manifest.json
        img-01-gyroid-hx.jpg
    heat-exchanger-2026-03-06/
      ...
```
