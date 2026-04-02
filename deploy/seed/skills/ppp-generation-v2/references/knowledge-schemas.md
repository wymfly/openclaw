# Knowledge Base Schemas — Core Libraries

## 1. Material JSON Schema

File: `knowledge/materials/{grade}.json`

```json
{
  "grade": "Ti6Al4V",
  "category": "titanium",
  "aliases": ["Grade 5", "Ti64", "TC4"],
  "density_g_cm3": 4.43,
  "chemical_composition": {
    "Ti": "Balance",
    "Al": "5.50-6.75",
    "V": "3.50-4.50",
    "Fe": "<=0.30",
    "O": "<=0.20",
    "C": "<=0.08",
    "N": "<=0.05",
    "H": "<=0.015"
  },
  "mechanical_properties": {
    "as_built": {
      "UTS_MPa": [1150, 1250],
      "YS_MPa": [1000, 1100],
      "elongation_pct": [4, 8],
      "hardness_HRC": [36, 42]
    },
    "stress_relieved": {
      "UTS_MPa": [1050, 1150],
      "YS_MPa": [950, 1050],
      "elongation_pct": [8, 12],
      "hardness_HRC": [33, 38]
    },
    "HIP": {
      "UTS_MPa": [950, 1050],
      "YS_MPa": [850, 950],
      "elongation_pct": [12, 16],
      "hardness_HRC": [30, 35]
    },
    "fatigue_limit_MPa_HIP": [450, 580],
    "elastic_modulus_GPa": 110
  },
  "thermal_properties": {
    "melting_point_C": 1660,
    "thermal_conductivity_W_mK": 6.7,
    "CTE_um_mK": 8.6,
    "specific_heat_J_kgK": 526
  },
  "powder_spec": {
    "PSD_um": [15, 53],
    "D10_um": [20, 25],
    "D50_um": [30, 40],
    "D90_um": [45, 55],
    "sphericity_min": 0.9,
    "flowability_Hall_s_50g_max": 30,
    "apparent_density_g_cm3_min": 2.2,
    "oxygen_wt_pct_max": 0.15
  },
  "powder_management": {
    "max_recycle_count": 15,
    "sieve_mesh_um": 63,
    "max_virgin_recycled_ratio": "1:3",
    "storage_humidity_rh_max": 40,
    "storage_temp_C": [15, 25],
    "storage_atmosphere": "Ar blanket recommended",
    "shelf_life_opened_days": 90,
    "retest_interval_cycles": 5
  },
  "heat_treatment": {
    "stress_relief": {
      "temperature_C": [655, 685],
      "time_h": 2,
      "ramp_rate_C_min": [5, 10],
      "cooling": "furnace cool to 300C, then Ar gas cool",
      "atmosphere": "vacuum <1e-4 mbar or Ar"
    },
    "HIP": {
      "temperature_C": [910, 930],
      "pressure_MPa": [95, 105],
      "time_h": 2,
      "ramp_rate_C_min": [5, 8],
      "cooling": "cool under pressure to 400C, then depressurize",
      "atmosphere": "Ar 99.99%"
    },
    "solution": {
      "temperature_C": [950, 970],
      "time_h": 1,
      "atmosphere": "vacuum"
    },
    "aging": {
      "temperature_C": [480, 520],
      "time_h": 8,
      "atmosphere": "vacuum"
    }
  },
  "corrosion_resistance": "excellent",
  "applicable_standards": ["ASTM F2924", "ASTM F3001", "AMS 4999"],
  "compatible_processes": ["L-PBF", "EBM", "DED"],
  "typical_applications": ["aerospace", "medical", "sports"],
  "sources": [
    {
      "title": "SLM Solutions MDS Ti6Al4V (2024)",
      "url": "https://www.slm-solutions.com/...",
      "tier": "manufacturer"
    }
  ],
  "last_updated": "2026-03-07"
}
```

Key changes from v1: Added `powder_management` section and `ramp_rate_C_min` +
`cooling` method in heat treatment (needed for Build Package SOPs).

---

## 2. Process JSON Schema

File: `knowledge/processes/{process-name}.json`

```json
{
  "name": "L-PBF",
  "aliases": ["SLM", "DMLS", "Laser Powder Bed Fusion"],
  "category": "PBF",
  "energy_source": "laser",
  "compatible_materials": ["Ti6Al4V", "316L", "IN718", "AlSi10Mg", "CoCrMo", "17-4PH"],
  "parameters": {
    "Ti6Al4V": {
      "laser_power_W": [250, 350],
      "scan_speed_mm_s": [900, 1200],
      "layer_thickness_um": [20, 60],
      "hatch_spacing_um": [100, 140],
      "energy_density_J_mm3": [50, 75],
      "scan_strategy": "stripes with 67 deg rotation",
      "stripe_width_mm": [5, 10],
      "contour_scans": [1, 3],
      "contour_offset_mm": [0.02, 0.05],
      "atmosphere": "Ar",
      "oxygen_ppm_max": 200,
      "preheat_C": [100, 300]
    }
  },
  "capabilities": {
    "min_wall_mm": 0.4,
    "min_hole_mm": 0.5,
    "min_gap_mm": 0.3,
    "max_overhang_deg": 45,
    "min_feature_mm": 0.2,
    "typical_accuracy_mm": [0.05, 0.1],
    "surface_Ra_um": [6, 16]
  },
  "typical_equipment": [
    { "name": "EOS M290", "build_mm": "250x250x325", "laser": "400W" },
    { "name": "SLM 280", "build_mm": "280x280x365", "laser": "2x700W" },
    { "name": "Renishaw AM500", "build_mm": "250x250x350", "laser": "500W" }
  ],
  "sources": [],
  "last_updated": "2026-03-07"
}
```

Key changes from v1: Added `stripe_width_mm` and `contour_offset_mm` (needed for
Build Package slicing parameters).

---

## 3. DfAM Rules JSON Schema

File: `knowledge/dfam_rules/{process-name}.json`

```json
{
  "process": "L-PBF",
  "geometry_constraints": {
    "min_wall_mm": { "value": 0.4, "note": "material dependent, 0.3 for 316L" },
    "min_hole_diameter_mm": { "value": 0.5, "note": "vertical; horizontal need support below 8mm" },
    "min_gap_mm": { "value": 0.3, "note": "between adjacent faces" },
    "max_overhang_deg": { "value": 45, "note": "self-supporting angle, material dependent" },
    "max_aspect_ratio": { "value": 8, "note": "height:width for unsupported walls" },
    "min_detail_mm": { "value": 0.2, "note": "limited by laser spot size" }
  },
  "support_guidelines": {
    "types": ["block", "tree", "cone"],
    "overhang_threshold_deg": 45,
    "tooth_height_mm": [0.5, 1.0],
    "tooth_top_mm": [0.3, 0.5],
    "tooth_base_mm": [0.8, 1.2],
    "contact_spacing_mm": [1.0, 2.0],
    "removal_accessibility": "must be reachable by tool or vibration",
    "powder_evacuation_holes_mm_min": 3,
    "powder_evacuation_count_min": 2,
    "fragmentation_pitch_mm": [8, 15]
  },
  "build_direction": {
    "surface_quality": "down-facing surfaces have worst quality",
    "anisotropy": "Z-direction typically 10-15% weaker in tensile",
    "support_minimization": "orient to minimize overhang area",
    "thermal_stress": "minimize large cross-section area changes in Z"
  },
  "sources": [{ "title": "EOS DfAM Guide", "url": "https://www.eos.info/..." }],
  "last_updated": "2026-03-07"
}
```

Key changes from v1: Added detailed `support_guidelines` with tooth parameters
and fragmentation (needed for Build Package Ch12.2).

---

## 4. Standard JSON Schema

File: `knowledge/standards/{standard-code}.json`

```json
{
  "code": "ASTM F2924",
  "title": "Standard Specification for Additive Manufacturing Titanium-6 Aluminum-4 Vanadium with Powder Bed Fusion",
  "version": "F2924-14 (Reapproved 2021)",
  "scope": "Ti6Al4V parts produced by PBF",
  "key_requirements": {
    "chemistry": "Al 5.50-6.75, V 3.50-4.50, Fe <=0.30, O <=0.20 wt%",
    "UTS_min_MPa": 895,
    "YS_min_MPa": 825,
    "elongation_min_pct": 10,
    "density_min_pct": 99.5,
    "hardness_HRC": [31, 37]
  },
  "test_methods": ["ASTM E8 (tensile)", "ASTM E466 (fatigue)", "ASTM E18 (hardness)"],
  "related_standards": ["ASTM F3001", "ASTM F3301", "ASTM F3049"],
  "url": "https://www.astm.org/f2924-14r21.html",
  "last_updated": "2026-03-07"
}
```

Key change from v1: Added explicit `hardness_HRC` range (needed for Build Package
test matrix acceptance criteria).

---

## 5. Domain Cache Markdown Format

File: `knowledge/domain_cache/{category-slug}.md`

```markdown
---
category: Category/Subcategory/Item
last_researched: 2026-03-07
confidence: 0.85
---

# Item Name - Category Research Cache

## Compliance Constraints

- Standard/rule: specification
- Source: URL

## Typical Dimensions & Weight

- Dimension 1: value (source)
- Dimension 2: value (source)

## Loading Conditions

- Load case 1: force, duration, cycles
- Load case 2: ...

## Industry References

- Mainstream materials
- Known 3D printing cases with params
```

---

## 6. Case Study Markdown Format

File: `knowledge/cases/{case-slug}.md`

```markdown
---
title: Case Title
company: Company Name
material: Material Grade
process: Process Name
equipment: Machine Model
date_published: YYYY
confidence: 0.75
---

# Case Study Title

## Key Parameters

- Material: grade
- Process: name (machine model)
- Production volume: N/year
- Structure: description

## Innovation

- Key innovations and results

## Quantitative Results

- Specific numbers: weight, strength, cost savings, etc.

## Source

URL
```
