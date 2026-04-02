# Knowledge Base Schemas — Extended Libraries (Build Package)

These four libraries are used primarily for Build Package generation (Ch12-14 + SOPs).
They supplement the core libraries defined in `knowledge-schemas.md`.

---

## 1. Equipment Database

File: `knowledge/equipment/{model-slug}.json`

```json
{
  "manufacturer": "EOS",
  "model": "M290",
  "slug": "eos-m290",
  "category": "L-PBF",
  "build_volume_mm": {
    "x": 250,
    "y": 250,
    "z": 325
  },
  "laser": {
    "type": "Yb-fiber",
    "count": 1,
    "power_W": 400,
    "spot_diameter_um": [80, 100]
  },
  "recoater": {
    "type": "blade",
    "material": "HSS or ceramic",
    "direction": "Y-axis"
  },
  "gas_flow": {
    "gas": "Ar or N2",
    "direction": "cross-flow Y-axis",
    "flow_rate_L_min": [20, 40],
    "O2_target_ppm": 100
  },
  "preheat": {
    "substrate_max_C": 200,
    "method": "resistive heating"
  },
  "monitoring_systems": {
    "standard": ["EOSTATE Base (melt pool)", "recoater monitoring"],
    "optional": ["EOSTATE Exposure OT (optical tomography)", "EOSTATE MeltPool (MPM)"]
  },
  "validated_materials": [
    {
      "material": "Ti6Al4V",
      "parameter_set": "Ti64_Performance_M291_400W",
      "validated": true,
      "source": "EOS official parameter set"
    },
    {
      "material": "AlSi10Mg",
      "parameter_set": "AlSi10Mg_Speed_M291_400W",
      "validated": true,
      "source": "EOS official parameter set"
    }
  ],
  "software": {
    "build_prep": "EOSPRINT 2.x",
    "monitoring": "EOSTATE Dashboard",
    "compatible_third_party": ["Magics", "Netfabb", "Amphyon"]
  },
  "deposition_rate_cm3_h": {
    "Ti6Al4V": [5, 15],
    "AlSi10Mg": [10, 25]
  },
  "maintenance": {
    "filter_change_interval_h": 500,
    "laser_window_clean_interval_h": 100,
    "recoater_replace_interval_h": 1000,
    "calibration_interval_months": 6
  },
  "typical_cost_per_hour_USD": [50, 100],
  "sources": [
    {
      "title": "EOS M290 Technical Data (2024)",
      "url": "https://www.eos.info/en-us/metal-solutions/metal-printers/eos-m-290",
      "tier": "manufacturer"
    }
  ],
  "last_updated": "2026-03-07"
}
```

---

## 2. Post-Processing Database

File: `knowledge/post_processing/{material}-{process-type}.json`

```json
{
  "material": "Ti6Al4V",
  "process_type": "stress_relief",
  "category": "heat_treatment",
  "detailed_cycle": {
    "steps": [
      {
        "step": 1,
        "action": "Load parts and coupons",
        "notes": "Parts on ceramic supports, avoid metal-to-metal contact"
      },
      {
        "step": 2,
        "action": "Evacuate furnace",
        "target": "< 1e-4 mbar",
        "alternative": "Ar purge to O2 < 50 ppm"
      },
      {
        "step": 3,
        "action": "Ramp to hold temperature",
        "ramp_rate_C_min": [5, 10],
        "target_C": [655, 685]
      },
      {
        "step": 4,
        "action": "Hold",
        "temperature_C": [655, 685],
        "tolerance_C": 10,
        "time_h": 2
      },
      {
        "step": 5,
        "action": "Cool",
        "method": "furnace cool to 300C, then Ar backfill and gas cool",
        "rate_C_min_max": 20
      }
    ]
  },
  "furnace_requirements": {
    "type": "vacuum furnace with Ar backfill capability",
    "uniformity_C": 10,
    "min_vacuum_mbar": 1e-4,
    "thermocouple_count": 3,
    "chart_recorder": "required"
  },
  "witness_coupon": {
    "required": true,
    "type": "hardness block",
    "acceptance": "HRC within specified range"
  },
  "applicable_standards": ["ASTM F3301", "AMS 2801"],
  "sources": [],
  "last_updated": "2026-03-07"
}
```

Additional process types per material:

- `{material}-hip.json`
- `{material}-solution-aging.json`
- `{material}-machining.json` (cutting parameters, stock allowance)
- `{material}-surface-finishing.json` (blasting, polishing, etching)

**Machining schema example** (`Ti6Al4V-machining.json`):

```json
{
  "material": "Ti6Al4V",
  "process_type": "machining",
  "category": "subtractive",
  "stock_allowance_mm": {
    "general_surfaces": [0.3, 0.5],
    "precision_surfaces": [0.5, 1.0],
    "bearing_surfaces": [1.0, 1.5]
  },
  "cutting_parameters": {
    "turning": {
      "speed_m_min": [30, 60],
      "feed_mm_rev": [0.1, 0.3],
      "depth_mm": [0.5, 2.0],
      "tool": "carbide, coated (TiAlN)",
      "coolant": "flood, water-soluble"
    },
    "milling": {
      "speed_m_min": [25, 50],
      "feed_mm_tooth": [0.05, 0.15],
      "depth_mm": [0.3, 1.5],
      "tool": "carbide end mill, 4-flute",
      "coolant": "flood"
    }
  },
  "fixture_considerations": [
    "AM parts have irregular geometry — custom soft jaws recommended",
    "Avoid clamping on thin walls (< 2mm)",
    "Use sacrificial support features as fixture references if designed in"
  ],
  "sources": [],
  "last_updated": "2026-03-07"
}
```

---

## 3. Defect Database

File: `knowledge/defects/{process-name}.json`

```json
{
  "process": "L-PBF",
  "defects": [
    {
      "name": "Gas Porosity",
      "description": "Spherical voids from trapped gas in powder or melt pool",
      "typical_size_um": [10, 100],
      "root_causes": [
        "High moisture content in powder",
        "Excessive energy density (keyhole mode)",
        "Powder with high gas content (atomization defects)"
      ],
      "prevention": [
        "Control powder moisture < 500 ppm",
        "Optimize energy density within 50-75 J/mm3 range",
        "Use gas-atomized powder with low internal porosity",
        "Pre-dry powder at 80-120C for 2-4h (material dependent)"
      ],
      "detection_methods": ["CT scan (ASTM E1441)", "Metallography", "Archimedes density"],
      "acceptance_criteria": {
        "aerospace": "No pore > 50um, total porosity < 0.1%",
        "industrial": "No pore > 100um, total porosity < 0.5%",
        "prototype": "Total porosity < 1%"
      },
      "severity": "medium"
    },
    {
      "name": "Lack of Fusion (LOF)",
      "description": "Irregular voids from incomplete melting between layers or tracks",
      "typical_size_um": [50, 500],
      "root_causes": [
        "Insufficient energy density (< 40 J/mm3)",
        "Excessive scan speed",
        "Layer thickness too high for available power",
        "Hatch spacing too large",
        "Recoating defect (short feed)"
      ],
      "prevention": [
        "Maintain energy density > 50 J/mm3 (material dependent)",
        "Validate overlap between hatch and contour scans",
        "Monitor recoater for consistent powder delivery",
        "Use validated parameter sets from equipment manufacturer"
      ],
      "detection_methods": ["CT scan", "Metallography", "Ultrasonic testing"],
      "acceptance_criteria": {
        "aerospace": "Zero LOF defects",
        "industrial": "No LOF > 200um",
        "prototype": "No LOF > 500um"
      },
      "severity": "critical"
    },
    {
      "name": "Residual Stress / Distortion",
      "description": "Internal stresses from rapid heating/cooling causing warping or cracking",
      "root_causes": [
        "High thermal gradient inherent to L-PBF",
        "Large cross-section area changes in Z",
        "Insufficient support structure",
        "No preheating"
      ],
      "prevention": [
        "Optimize scan strategy (island/checkerboard to reduce stress)",
        "Use substrate preheating (100-300C)",
        "Design adequate support structure",
        "Orient to minimize large flat cross-sections",
        "Stress relief before part removal from substrate"
      ],
      "detection_methods": [
        "Visual (warping)",
        "CMM (dimensional check)",
        "XRD (stress measurement)"
      ],
      "severity": "high"
    },
    {
      "name": "Surface Roughness Exceeds Spec",
      "description": "As-built surface rougher than target Ra",
      "typical_Ra_um": [6, 20],
      "root_causes": [
        "Staircase effect on angled surfaces",
        "Balling on down-facing surfaces",
        "Partially melted powder particles adhered to surface",
        "Insufficient contour scans"
      ],
      "prevention": [
        "Optimize build orientation for critical surfaces",
        "Use downskin parameters for overhanging surfaces",
        "Increase contour scans to 2-3",
        "Plan post-processing for surfaces requiring Ra < 3 um"
      ],
      "detection_methods": ["Profilometer (contact/optical)", "Visual comparison"],
      "severity": "low"
    },
    {
      "name": "Cracking",
      "description": "Macro or micro cracks from thermal stress or material issues",
      "root_causes": [
        "Excessive residual stress (no stress relief before EDM)",
        "Material susceptibility (e.g., high-carbon steels, some Ni alloys)",
        "Substrate/part material mismatch causing differential contraction",
        "Too-aggressive heat treatment ramp rate"
      ],
      "prevention": [
        "Stress relief BEFORE substrate removal",
        "Use compatible substrate material",
        "Control heat treatment ramp rate (< 10C/min for crack-sensitive alloys)",
        "Pre-heat substrate"
      ],
      "detection_methods": ["Visual", "Dye penetrant (ASTM E1417)", "CT scan"],
      "severity": "critical"
    }
  ],
  "sources": [],
  "last_updated": "2026-03-07"
}
```

---

## 4. Test Coupon Database

File: `knowledge/test_coupons/{test-type}.json`

```json
{
  "test_type": "tensile",
  "standard": "ASTM E8/E8M",
  "variants": [
    {
      "id": "round-6mm",
      "description": "Standard round specimen, 6mm gauge diameter",
      "geometry": {
        "gauge_diameter_mm": 6,
        "gauge_length_mm": 24,
        "fillet_radius_mm": 6,
        "grip_diameter_mm": 10,
        "grip_length_mm": 15,
        "total_length_mm": 60
      },
      "as_built_stock_mm": 1.0,
      "post_machining_required": true,
      "notes": "Most common for AM metals. Machine after heat treatment."
    },
    {
      "id": "flat-6x25",
      "description": "Flat specimen for sheet-like geometries",
      "geometry": {
        "gauge_width_mm": 6,
        "gauge_length_mm": 25,
        "gauge_thickness_mm": 3,
        "fillet_radius_mm": 6,
        "grip_width_mm": 12,
        "total_length_mm": 100
      },
      "as_built_stock_mm": 0.5,
      "post_machining_required": true,
      "notes": "Use when round specimens cannot be extracted from part geometry."
    }
  ],
  "placement_rules": {
    "min_per_orientation": 2,
    "recommended_orientations": ["X", "Y", "Z", "45deg"],
    "position_strategy": "corners + center + adjacent-to-part",
    "z_height_match": "Place at same Z-range as part critical features when possible",
    "thermal_history": "Adjacent-to-part coupons represent actual part thermal history"
  },
  "post_processing_rule": "Coupons MUST undergo identical post-processing as the part (co-loaded in same furnace run)",
  "test_conditions": {
    "strain_rate_per_s": 0.005,
    "temperature_C": "room temperature (23 +/- 5 C)",
    "extensometer": "required for YS and elongation measurement"
  },
  "sources": [
    {
      "title": "ASTM E8/E8M-22 Standard Test Methods for Tension Testing of Metallic Materials",
      "url": "https://www.astm.org/e0008_e0008m-22.html"
    }
  ],
  "last_updated": "2026-03-07"
}
```

Additional test coupon files:

- `fatigue.json` (ASTM E466, hourglass geometry)
- `hardness.json` (ASTM E18, block geometry)
- `density.json` (ASTM B311, cube geometry)
- `metallography.json` (cross-section blocks, XY + XZ planes)
- `ct-witness.json` (mini-part or representative geometry)
