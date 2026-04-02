# PPP Report Template (Ch1-11)

## Report Structure

### Cover Page

- PrintSpec logo + subtitle
- Product name (Chinese + English)
- "Part Production Plan"
- Metadata: Report ID, Performance Tier, Date, Version, Classification
- Overall Confidence score with visual bar

### Table of Contents

### Chapter 1: Product Overview

- 1.1 Object description and use case
- 1.2 Industry classification
- 1.3 Functional requirements summary (table: requirement / description / source[n])
- 1.4 Reference cases (table + case study images with captions and [n])
- 1.5 Applicable standards overview (table: standard / scope / source[n])

### Chapter 2: Design Specifications

- 2.1 Form reference and typical variants (table + product reference images)
- 2.2 Dimensional specs (table: parameter / spec value / source[n])
- 2.3 Weight distribution (table: component / typical weight / percentage / source[n])
- 2.4 CAD design guidelines

### Chapter 3: Material Selection

- 3.1 Candidate material comparison matrix (table with [n] per column)
- 3.2 Recommended material data sheet (composition, mechanical, powder spec)
- 3.3 **Selection Reasoning** <- REASONING BOX
  - Question: "Why choose X over other candidates?"
  - Numbered factors with quantitative FACT data + [n] refs
  - Elimination reasons for each rejected candidate
- 3.4 Compliance standards

### Chapter 4: Internal Structure Design

- 4.1 Structure options comparison (2-3 options table)
- 4.2 Recommended design detail (parameter table + structure images/SVG)
- 4.3 **Design Decision Reasoning** <- REASONING BOX
- 4.4 Minimum feature size constraints (table: feature / min value / source[n])
- 4.5 Support structure strategy

### Chapter 5: Surface Quality & Post-Processing

- 5.1 Surface quality targets by zone (table: zone / target Ra / as-built Ra / method / source[n])
- 5.2 Post-processing route (flow-box diagram)
- 5.3 Heat treatment specification (table: step / temp / pressure / time / atmosphere / standard[n])

### Chapter 6: Print Process

- 6.1 Recommended print technology and rationale
- 6.2 **Process Selection Reasoning** <- REASONING BOX
- 6.3 Key process parameters (table: param / recommended / valid range / source[n])
- 6.4 Build orientation analysis (table with badges + SVG diagram)
- 6.5 Equipment recommendations (table)
- 6.6 Estimated print time (table)

### Chapter 7: Mechanical Validation & Simulation

- 7.1 Critical load cases (table with [n] refs)
- 7.2 Key performance metrics (table: metric / target / test standard)
- 7.3 Recommended simulations (table)
- 7.4 Test validation plan (ordered list)

### Chapter 8: Quality Control Plan

- 8.1 Raw material inspection (table: item / method / acceptance / frequency / source[n])
- 8.2 In-process monitoring (table)
- 8.3 Witness coupons (table)
- 8.4 Non-destructive examination NDE (table)
- 8.5 Acceptance criteria summary (table with [n] refs)

### Chapter 9: Cost Estimation

- 9.1 Cost breakdown (table: item / cost / percentage / notes / source[n])
- 9.2 Batch effects (table)
- 9.3 Comparison with traditional manufacturing (table)
- Note box: cost conclusion

### Chapter 10: Compliance & Standards

- 10.1 Applicable standards list (table with [n])
- 10.2 Industry compliance constraints (table if applicable)
- 10.3 Certification path recommendations (ordered list)
- 10.4 IP considerations

### Chapter 11: Innovation Proposals & Technology Roadmap

- 11.1 Parameter Window Optimization (three-column table)
- 11.2 High-Confidence Innovation Cards (3-5, TRL >= 5)
- 11.3 Exploratory Proposals (2-3, TRL 3-4)
- 11.4 Technology Roadmap: short-term (implement now) vs medium-term (need validation)

### Appendix A: References

```
[n] Title
    Source Organization
    URL (full, clickable)
    Data used: what specific data was extracted
```

### Appendix B: Research Trail

- B.1 Search tasks executed (table: # / query / purpose / chapter / result)
- B.2 KB coverage vs online research (table with badges: KB / Search / LLM)
- B.3 Known data gaps (bullet list)

### Appendix C: Confidence Notes

- Per-chapter confidence table (badges: green >= 80%, yellow 70-79%, red < 70%)
- Source tier weight table

---

## HTML Patterns

### Image Embedding

```html
<figure style="text-align:center;margin:16px 0;">
  <img
    src="images/filename.jpg"
    alt="description"
    style="max-width:100%;max-height:300px;border-radius:4px;border:1px solid #e0e0e0;"
  />
  <figcaption style="font-size:8.5pt;color:#666;margin-top:6px;">
    Fig N: Caption <a class="cite" href="#refN">[N]</a>
  </figcaption>
</figure>
```

### Reasoning Box

```html
<div class="reasoning">
  <div class="reasoning-title">Selection Reasoning: Why X?</div>
  <p><strong>Question:</strong> ...</p>
  <ol>
    <li><strong>Factor 1</strong>: FACT data [n] ...</li>
  </ol>
  <p><strong>Conclusion (DECISION):</strong> ...</p>
  <p><strong>Eliminated:</strong> Y (reason), Z (reason)</p>
</div>
```

### Innovation Card

```html
<div class="innovation-card">
  <div class="innovation-title"><span class="badge badge-purple">INNOV TRL-N</span> Title</div>
  <table>
    <tr>
      <td>Industry Practice</td>
      <td>...</td>
    </tr>
    <tr>
      <td>Our Proposal</td>
      <td>...</td>
    </tr>
    <tr>
      <td>Expected Improvement</td>
      <td>...</td>
    </tr>
    <tr>
      <td>Data Basis</td>
      <td>INNOV: [KB refs] + [physics reasoning]</td>
    </tr>
    <tr>
      <td>TRL</td>
      <td>N - description</td>
    </tr>
    <tr>
      <td>Risk</td>
      <td>...</td>
    </tr>
    <tr>
      <td>Validation Plan</td>
      <td>specimens, tests, acceptance</td>
    </tr>
    <tr>
      <td>Investment</td>
      <td>time + cost</td>
    </tr>
  </table>
</div>
```

### Data Provenance Badges

```html
<!-- FACT -->
<a class="cite" href="#refN">[N]</a>

<!-- CALC -->
<a class="cite" href="#refN">[N]</a> <span class="badge badge-green">CALC</span>

<!-- ENGR -->
<span class="badge badge-yellow">Engineering Judgment</span>

<!-- INNOV -->
<span class="badge badge-purple">INNOV TRL-N</span>
```

---

## CSS Stylesheet

```css
@page {
  size: A4;
  margin: 25mm 20mm;
}
body {
  font-family: "Noto Sans SC", "Segoe UI", sans-serif;
  font-size: 10pt;
  line-height: 1.6;
  color: #333;
  max-width: 210mm;
  margin: 0 auto;
  padding: 20mm;
}
h1 {
  font-size: 16pt;
  color: #1a237e;
  border-bottom: 2px solid #3f51b5;
  padding-bottom: 6px;
  page-break-after: avoid;
}
h2 {
  font-size: 13pt;
  color: #283593;
  margin-top: 18px;
  page-break-after: avoid;
}
h3 {
  font-size: 11pt;
  color: #3949ab;
  page-break-after: avoid;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
  font-size: 9pt;
  page-break-inside: avoid;
}
th {
  background: #e8eaf6;
  color: #1a237e;
  padding: 8px 10px;
  text-align: left;
  border: 1px solid #c5cae9;
}
td {
  padding: 6px 10px;
  border: 1px solid #e0e0e0;
  vertical-align: top;
}
tr:nth-child(even) {
  background: #fafafa;
}

.cover {
  text-align: center;
  page-break-after: always;
  padding-top: 60px;
}
.cover h1 {
  font-size: 28pt;
  border: none;
  color: #1a237e;
}
.cover .subtitle {
  font-size: 14pt;
  color: #5c6bc0;
  margin: 10px 0 40px;
}

.chapter {
  page-break-before: always;
}
.appendix {
  page-break-before: always;
}

.reasoning {
  background: #f3e5f5;
  border-left: 3px solid #9c27b0;
  padding: 14px 16px;
  margin: 14px 0;
  border-radius: 0 6px 6px 0;
}
.reasoning-title {
  color: #6a1b9a;
  font-weight: 700;
  font-size: 11pt;
  margin-bottom: 8px;
}

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
  width: 110px;
  color: #3f51b5;
}

.note {
  background: #fff8e1;
  border-left: 3px solid #ffc107;
  padding: 12px 16px;
  margin: 14px 0;
  border-radius: 0 6px 6px 0;
  font-size: 9.5pt;
}

.cite {
  color: #1565c0;
  font-size: 8pt;
  vertical-align: super;
  text-decoration: none;
}
.cite:hover {
  text-decoration: underline;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 8pt;
  font-weight: 600;
}
.badge-green {
  background: #e8f5e9;
  color: #2e7d32;
}
.badge-yellow {
  background: #fff8e1;
  color: #f57f17;
}
.badge-blue {
  background: #e3f2fd;
  color: #1565c0;
}
.badge-purple {
  background: #f3e5f5;
  color: #6a1b9a;
}
.badge-red {
  background: #ffebee;
  color: #c62828;
}

.flow-box {
  background: #eceff1;
  border: 1px solid #b0bec5;
  padding: 14px;
  border-radius: 6px;
  font-family: "Courier New", monospace;
  font-size: 9pt;
  white-space: pre-wrap;
  margin: 12px 0;
}

.recommend {
  background: #e8f5e9 !important;
  font-weight: 600;
}

.ref-list td {
  font-size: 8.5pt;
}
.ref-list td:first-child {
  width: 30px;
  text-align: center;
  font-weight: 700;
  color: #1565c0;
}

.confidence-bar {
  height: 8px;
  border-radius: 4px;
  background: #e0e0e0;
}
.confidence-fill {
  height: 100%;
  border-radius: 4px;
}
```

---

## Confidence Calculation

```
chapter_confidence = weighted_average(section_data_sources)

source_weights = {
  "standard": 1.00,
  "manufacturer": 0.95,
  "academic": 0.85,
  "industry_case": 0.75,
  "cost_platform": 0.65,
  "llm_reasoning": 0.60,
}

overall_confidence = weighted_average(chapter_confidences)
# Ch3 (material) and Ch6 (process) have 1.5x weight
```
