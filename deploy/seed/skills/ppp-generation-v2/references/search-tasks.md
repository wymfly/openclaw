# Search Tasks Reference

## Gap Matrix: Chapter → Data Source → Typical Gaps

| Chapter                 | Needs (source)                                                           | Typically missing                                      |
| ----------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------ |
| Ch1 Product Overview    | category desc [KB], cases [KB/SEARCH], standards [KB]                    | Cases for new categories                               |
| Ch2 Design Specs        | dimensions [SEARCH], geometry [SEARCH], compliance [KB], images [SEARCH] | Category-specific dimensions almost always need search |
| Ch3 Material            | properties [KB], comparison [KB], powder spec [KB], competitors [SEARCH] | Competitor data for reasoning boxes                    |
| Ch4 Structure           | design options [LLM], wall thickness [KB+SEARCH], DfAM [KB]              | Category-specific structure needs LLM                  |
| Ch5 Surface & Post      | Ra targets [KB], post-process route [KB], heat treatment [KB]            | Category-specific surface needs                        |
| Ch6 Print Process       | parameters [KB], equipment [KB], time [CALC]                             | Usually well-covered                                   |
| Ch7 Mechanical          | load cases [SEARCH+LLM], targets [KB], simulation [LLM]                  | Category-specific loads always need search             |
| Ch8 QC                  | QC template [KB], inspection standards [KB]                              | Usually well-covered                                   |
| Ch9 Cost                | powder price [SEARCH], print cost [CALC], post cost [KB+CALC]            | Prices need fresh data                                 |
| Ch10 Compliance         | standards list [KB], regulations [KB/SEARCH]                             | Industry-specific regulations                          |
| Ch11 Innovation         | KB parameter ranges [KB], frontier research [SEARCH], reasoning [LLM]    | Parameter ranges must come from KB                     |
| Ch12 Build Prep         | equipment params [KB/SEARCH], support rules [KB], slicing [SEARCH]       | Equipment-specific parameters                          |
| Ch13 Test Coupons       | coupon geometry [KB], test matrix [KB/SEARCH]                            | Orientation-specific quantities                        |
| Ch14 Process Monitoring | monitoring thresholds [SEARCH], powder mgmt [KB/SEARCH]                  | Equipment-specific thresholds                          |

---

## PPP Report Search Tasks (T1-T7 + I1-I3)

### Text Research

| Task | Query Pattern                                                | Purpose                                              | Target Chapter | Dependencies                       | Parallel Group |
| ---- | ------------------------------------------------------------ | ---------------------------------------------------- | -------------- | ---------------------------------- | -------------- |
| T1   | "{object} specifications dimensions standards"               | Compliance + sizing                                  | Ch2, Ch10      | None                               | A              |
| T2   | "3D printed {object} case study additive manufacturing"      | Industry cases                                       | Ch1            | None                               | A              |
| T3   | "{object} internal structure design {material}"              | Structure reference                                  | Ch4            | None                               | A              |
| T4   | "{object} loading conditions forces impact fatigue"          | Mechanical data                                      | Ch7            | None                               | A              |
| T5   | "{material} powder price per kg {year}"                      | Cost data                                            | Ch9            | None                               | A              |
| T6   | "{competitor_material} vs {primary_material} {key_property}" | Competitor comparison — critical for reasoning boxes | Ch3            | T1-T3 results identify competitors | B              |
| T7   | "{competitor_material_2} {process} properties"               | Second competitor data                               | Ch3            | T1-T3 results                      | B              |

**Parallelization**: Group A tasks are independent — launch all in one turn.
Group B depends on material candidates identified from Group A results.

**Why T6/T7 matter**: Reasoning boxes in Ch3/Ch4/Ch6 require quantitative comparison
against eliminated candidates. Without competitor data, reasoning is qualitative and
unconvincing. Always search for at least 1-2 competitor materials.

### Image Research

| Task | Query Pattern                                | Purpose                          | Target Chapter | Parallel Group |
| ---- | -------------------------------------------- | -------------------------------- | -------------- | -------------- |
| I1   | "{object} 3D printed additive manufacturing" | AM-produced product photo        | Ch1, Ch2       | A              |
| I2   | "{structure_type} {object} cross section"    | Internal structure visualization | Ch4            | A              |
| I3   | "3D printed {object} {material} case study"  | Case study photos                | Ch1            | A              |

### Image Handling Workflow (Three-Level Fallback)

**Level 1: curl direct download** (try first)

```bash
mkdir -p {output_dir}/images
curl -L -o {output_dir}/images/{filename} "{image_url}" \
  --connect-timeout 10 --max-time 30 -s -w "%{http_code}"
```

HTTP 200 → success. 403/404/429 → Level 2.

**Level 2: Playwright page extraction** (anti-hotlinking, dynamic loading)

```
browser_navigate → open source page URL
browser_snapshot → locate <img> elements
browser_evaluate → extract actual image src
```

Then curl with Referer header. Still fails → Level 3.

**Level 3: Playwright screenshot** (last resort)

```
browser_navigate → open page
browser_take_screenshot → capture image area
```

**Level 4: SVG fallback**
Record in manifest.json with `"download_status": "failed"`. Use inline SVG.

**Always generate these SVG diagrams** regardless of web image availability:

- Build orientation diagram (Ch6): box with Z-arrow
- Post-processing flow chart (Ch5): step boxes with arrows
- Structure comparison diagram (Ch4): side-by-side concept sketches

**Image metadata** — save as `{output_dir}/images/manifest.json`:

```json
[
  {
    "id": "img-01",
    "filename": "gyroid-heat-exchanger.jpg",
    "source_url": "https://...",
    "source_org": "Conflux Technology",
    "caption": "Gyroid TPMS heat exchanger (Conflux Technology)",
    "license": "manufacturer press kit",
    "download_method": "curl",
    "used_in_chapters": [1, 4],
    "ref_id": 2
  }
]
```

**Image source priority** (prefer in order):

1. User-provided images
2. Manufacturer case study images (EOS, SLM Solutions, Conflux etc.)
3. Open-access academic figures (Creative Commons)
4. Industry media (3DPrintingIndustry, TCT)
5. SVG diagrams generated inline

**Search domain mapping** — restrict to authoritative sites:

```
material_data:     eos.info, slm-solutions.com, renishaw.com, matweb.com
process_params:    eos.info, slm-solutions.com, sciencedirect.com
industry_cases:    3dprintingindustry.com, tctmagazine.com, additivemanufacturing.media
cost_estimation:   xometry.com, protolabs.com, makerverse.com
standards:         astm.org, iso.org, standards.nasa.gov
domain_specific:   varies by category
```

---

## Build Package Search Tasks (T8-T13)

Only execute these when generating a Build Package.

| Task | Query Pattern                                                                | Purpose                       | Target Chapter     | Dependencies              |
| ---- | ---------------------------------------------------------------------------- | ----------------------------- | ------------------ | ------------------------- |
| T8   | "{equipment_model} {material} parameter set datasheet"                       | Machine-specific parameters   | Ch12               | Equipment model known     |
| T9   | "{material} AM support removal best practice guidelines"                     | Support removal methods       | Ch12, App D        | Material selected         |
| T10  | "{material} AM heat treatment ramp rate cooling method detailed cycle"       | Full thermal cycle parameters | Ch5 upgrade, App D | Material selected         |
| T11  | "{material} AM common defects porosity lack of fusion prevention"            | Defect prevention             | Ch14, Ch8          | Process selected          |
| T12  | "ASTM E8 test coupon additive manufacturing {material} orientation quantity" | Test coupon standards         | Ch13               | Material selected         |
| T13  | "{material} AM machining stock allowance fixture design CNC"                 | Machining specifications      | App D              | Material + geometry known |

**Parallelization**: T8-T13 are mostly independent (all depend on material/process
being selected, which is done in Phase 4). Launch T9-T13 in parallel; T8 requires
a specific equipment model.

---

## Research Trail Format

Save as `{output_dir}/research_trail.md`:

```markdown
# Research Trail

## Search Tasks Executed

| #   | Query | Purpose    | Results    | Confidence |
| --- | ----- | ---------- | ---------- | ---------- |
| T1  | "..." | Compliance | Found: ... | 0.95       |

## KB Coverage

| Library   | Items Found | Items Used | Gaps           |
| --------- | ----------- | ---------- | -------------- |
| materials | 3           | 2          | CuCrZr missing |

## Image Collection

| ID     | Source  | Method | Status  |
| ------ | ------- | ------ | ------- |
| img-01 | Conflux | curl   | success |

## Lessons Learned

- Which KB data was useful vs. which searches were needed?
- Were any search queries ineffective?
- What knowledge should have been in the KB but wasn't?
```
