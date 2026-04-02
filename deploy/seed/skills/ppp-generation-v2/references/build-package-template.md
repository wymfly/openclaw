# Build Package Template (Ch12-14 + Appendix D-F)

The Build Package is the manufacturing execution companion to the PPP Report.
It translates research decisions (material, process, structure) into machine-ready
specifications and step-by-step work instructions.

**Prerequisite**: A completed PPP Report for the same product. The Build Package
references PPP Report chapter decisions directly.

---

## Chapter 12: Build Preparation & Layout

### 12.1 Build Orientation

Precise orientation specification (not just "analysis"):

| Axis | Rotation | Rationale                                 |
| ---- | -------- | ----------------------------------------- |
| X    | +15°     | Critical surface A faces up for better Ra |
| Y    | 0°       | Symmetric geometry                        |
| Z    | N/A      | Build direction                           |

Include: SVG diagram showing part on build plate with coordinate axes.

Decision factors (reference PPP Ch4 structure + Ch7 loads):

- Critical surface quality requirements (from Ch5)
- Support volume minimization
- Thermal stress management (largest cross-section area gradient)
- Mechanical anisotropy alignment with primary load path (from Ch7)
- Recoater force direction vs thin features

### 12.2 Support Structure Design

| Parameter                  | Value               | Rationale                               |
| -------------------------- | ------------------- | --------------------------------------- |
| Support type               | Block / Tree / Cone | Per geometry region                     |
| Tooth height (mm)          | 0.5-1.0             | Balance: removal ease vs adhesion       |
| Tooth top length (mm)      | 0.3-0.5             | Smaller = easier removal                |
| Tooth base length (mm)     | 0.8-1.2             | Larger = better heat dissipation        |
| Contact point spacing (mm) | 1.0-2.0             | Per overhang angle                      |
| Fragmentation              | Yes/No + pitch (mm) | Ease of removal for large supports      |
| Support density (%)        | 50-80               | Balance: powder evacuation vs stability |

Per-region support map:

```
Region A (bottom overhang): Block support, 70% density
Region B (internal channel): Tree support, 60% density, fragmented @10mm
Region C (external face): Cone support, minimal contact
Region D (self-supporting >45°): No support
```

### 12.3 Build Plate Layout

| Parameter                 | Value                  |
| ------------------------- | ---------------------- |
| Parts per plate           | N                      |
| Inter-part spacing (mm)   | >= 5                   |
| Part-to-edge spacing (mm) | >= 10                  |
| Gas flow direction        | Arrow diagram          |
| Recoater direction        | Arrow diagram          |
| Critical parts position   | Center (best gas flow) |
| Test coupons position     | See Ch13               |

Include: Top-view SVG diagram of build plate layout.

### 12.4 Slicing Parameters

Machine-specific parameter set (reference from equipment KB or T8 search):

| Parameter           | Contour     | Infill      | Downskin      | Upskin   |
| ------------------- | ----------- | ----------- | ------------- | -------- |
| Laser power (W)     |             |             |               |          |
| Scan speed (mm/s)   |             |             |               |          |
| Hatch spacing (um)  | N/A         |             |               |          |
| Contour offset (mm) |             | N/A         | N/A           | N/A      |
| Border scans        |             | N/A         | N/A           | N/A      |
| Scan strategy       | Single line | Stripes 67° | Reduced speed | Standard |
| Stripe width (mm)   | N/A         | 5-10        | N/A           | N/A      |

### 12.5 Substrate Preparation

| Item                     | Specification                                              |
| ------------------------ | ---------------------------------------------------------- |
| Substrate material       | Match part material (e.g., Ti6Al4V plate for Ti6Al4V part) |
| Substrate thickness (mm) | 20-25                                                      |
| Surface prep             | Sandblast to Ra 3-6 um                                     |
| Preheat temperature (C)  | Per process KB                                             |
| Leveling tolerance (mm)  | +/- 0.05                                                   |
| Reuse criteria           | Max N uses, re-surface between uses                        |

---

## Chapter 13: Test Coupon Design & Test Matrix

### 13.1 Coupon Geometries

| Test Type       | Standard  | Geometry           | Key Dimensions                                     |
| --------------- | --------- | ------------------ | -------------------------------------------------- |
| Tensile         | ASTM E8   | Round bar / Flat   | Gauge: 6mm dia x 24mm (round) or 6mm x 25mm (flat) |
| Fatigue         | ASTM E466 | Hourglass          | Gauge: 5mm dia, radius 30mm                        |
| Hardness        | ASTM E18  | Block              | 15 x 15 x 10 mm                                    |
| Metallography   | N/A       | Block              | 10 x 10 x 15 mm (XY + XZ sections)                 |
| Density         | ASTM B311 | Cube               | 10 x 10 x 10 mm                                    |
| CT scan witness | N/A       | Mini-part geometry | Scaled or sectioned representative                 |

### 13.2 Placement Strategy

```
Build plate top view (280 x 280 mm example):
+--------------------------------------------------+
|  [T-Z1]           [T-45]           [T-Z2]        |  T = Tensile
|                                                    |  Z = Z-direction
|        [D1]    [PART 1]    [D2]                   |  45 = 45° direction
|                                                    |  X/Y = XY-direction
|  [M-XZ]      [PART 2]      [M-XY]                |  D = Density cube
|                                                    |  M = Metallography
|        [D3]    [PART 3]    [D4]                   |  H = Hardness
|                                                    |  F = Fatigue
|  [T-X1]    [H1]    [F1]    [H2]    [T-Y1]        |
+--------------------------------------------------+
  Gas flow →→→
```

Rules:

- Minimum 2 tensile coupons per orientation (X, Y, Z, 45°)
- At least 1 density cube per quadrant
- Metallography blocks: 1 XY-plane + 1 XZ-plane minimum
- Coupons placed at same Z-height as parts when possible
- Adjacent-to-part coupons for representative thermal history

### 13.3 Test Matrix

| Test          | Standard   | Orientation | Quantity    | Condition               | Acceptance Criteria                     |
| ------------- | ---------- | ----------- | ----------- | ----------------------- | --------------------------------------- |
| Tensile       | ASTM E8    | X           | 3           | Heat-treated            | UTS >= X MPa, YS >= Y MPa, EL >= Z%     |
| Tensile       | ASTM E8    | Y           | 3           | Heat-treated            | Same                                    |
| Tensile       | ASTM E8    | Z           | 3           | Heat-treated            | UTS >= X-10% MPa (anisotropy allowance) |
| Tensile       | ASTM E8    | 45°         | 2           | Heat-treated            | UTS >= X-5% MPa                         |
| Fatigue       | ASTM E466  | Z           | 5           | Heat-treated + machined | Run-out at N cycles @ S MPa             |
| Hardness      | ASTM E18   | N/A         | 3           | Heat-treated            | HRC X-Y                                 |
| Density       | ASTM B311  | N/A         | 4           | As-built                | >= 99.5%                                |
| Metallography | N/A        | XY + XZ     | 2           | Heat-treated            | No LOF, porosity < N%, grain size       |
| CT scan       | ASTM E1441 | N/A         | 1 (witness) | As-built                | No voids > 0.1mm                        |

Fill acceptance criteria from PPP Ch3 (material standards) and Ch8 (QC plan).

### 13.4 Coupon Post-Processing

**Critical rule**: All coupons must undergo identical post-processing as the part.

- Same heat treatment furnace run (co-loaded)
- Same HIP cycle
- Tensile/fatigue coupons: machined to final geometry AFTER heat treatment
- Density cubes: tested in as-built condition (before heat treatment)

---

## Chapter 14: Process Monitoring & Powder Management

### 14.1 In-Process Monitoring

| System                | Parameter            | Threshold                         | Action if Exceeded               |
| --------------------- | -------------------- | --------------------------------- | -------------------------------- |
| O2 sensor             | Oxygen level (ppm)   | < 200 (Ti), < 1000 (steel)        | Pause + purge                    |
| Recoater              | Force/current        | Manufacturer baseline + 20%       | Investigate, check for collision |
| Melt pool (if OT/MPM) | Intensity deviation  | +/- 15% from baseline             | Flag layer for review            |
| Powder bed camera     | Recoating uniformity | Visual: no short feed, no streaks | Pause + adjust recoater          |
| Build chamber temp    | Temperature drift    | +/- 5°C from setpoint             | Adjust heater                    |

Layer-by-layer photography: every N layers (N=10 for critical, N=50 for standard).

### 14.2 Powder Management Protocol

**Incoming Powder Inspection**:

| Test             | Method                        | Acceptance              | Frequency |
| ---------------- | ----------------------------- | ----------------------- | --------- |
| PSD              | Laser diffraction (ISO 13320) | D10/D50/D90 within spec | Every lot |
| Morphology       | SEM imaging                   | Sphericity >= 0.85      | Every lot |
| Flowability      | Hall flowmeter (ASTM B213)    | <= 30s/50g (Ti)         | Every lot |
| Chemistry        | ICP-OES or XRF                | Per material spec       | Every lot |
| Moisture         | Karl Fischer                  | < 500 ppm               | Every lot |
| Apparent density | ASTM B212                     | >= spec minimum         | Every lot |

**Powder Recycling Protocol**:

| Step           | Action                                             | Frequency                                    |
| -------------- | -------------------------------------------------- | -------------------------------------------- |
| 1. Collect     | Recover unfused powder from build chamber          | Every build                                  |
| 2. Sieve       | Sieve through XX um mesh (material-dependent)      | Every build                                  |
| 3. Blend       | Mix with virgin powder (max ratio recycled:virgin) | Every build                                  |
| 4. Test        | Flowability + PSD check                            | Every 3rd recycle                            |
| 5. Full retest | Chemistry + morphology                             | Every 5th recycle or if flowability degrades |
| 6. Retire      | Remove from service                                | After max N cycles or failed test            |

**Storage**:

- Container: sealed, desiccated, inert gas blanket (Ti/Al powders)
- Humidity: < 40% RH
- Temperature: 15-25°C
- Shelf life after opening: XX days (material-dependent)
- Lot traceability: label with lot#, receipt date, recycle count

### 14.3 Build Record Template

Each build must record:

| Category         | Fields                                                 |
| ---------------- | ------------------------------------------------------ |
| **Build ID**     | Unique identifier, date, operator                      |
| **Machine**      | Model, serial#, maintenance status, last calibration   |
| **Material**     | Powder lot#, virgin/recycled ratio, recycle count      |
| **Parameters**   | Parameter set version, any deviations from standard    |
| **Environment**  | O2 level range, chamber temp, humidity                 |
| **Build events** | Start/end time, pauses, alarms, operator interventions |
| **Result**       | Visual assessment, coupon IDs, disposition             |

---

## Appendix D: Standard Operating Procedures (SOPs)

Each SOP follows this structure:

1. **Purpose** — what this procedure achieves
2. **Scope** — when to use this SOP
3. **Equipment & Materials** — what you need
4. **Safety** — PPE, hazards, precautions
5. **Procedure** — numbered steps with decision points
6. **Records** — what to document
7. **References** — standards, manuals

### D.1 Powder Preparation SOP

- Sieve: mesh size, duration, equipment
- Dry: temperature, time, equipment (if needed)
- Blend: virgin/recycled ratio, mixing method, duration
- Sample: take retention sample, label
- Load: hopper loading procedure

### D.2 Machine Setup SOP

- Power on sequence
- Gas purge: flow rate, duration, target O2 level
- Substrate: mount, level, verify
- Preheat: target temperature, stabilization time
- Recoater: blade/roller type, test sweep
- Parameter file: load, verify version
- Build file: load, verify orientation matches Ch12

### D.3 Build Execution SOP

- Start build, verify first layers
- Monitoring checkpoints (per Ch14.1 thresholds)
- Pause/resume procedures
- Alarm response procedures
- Build completion: cool-down time (hours)

### D.4 Part Removal SOP

- Chamber opening: wait for temp < X°C
- Depowdering: brush, compressed air (pressure, distance), vibration
- Powder recovery: collect, label, store per D.1
- Wire EDM: cut height above substrate, wire type, feed rate
- Part-on-substrate handling: lifting points, transport container

### D.5 Support Removal SOP

- Tools: pliers, hand grinder, Dremel, dental picks
- Sequence: large supports first, then small
- Care areas: thin walls, fine features, surface finish zones
- Inspection: visual check for remaining support stubs
- Surface touch-up: local grinding/polishing if needed

### D.6 Heat Treatment SOP

Complete thermal cycle with specific ramp rates:

```
Step 1: Load parts + coupons in furnace
Step 2: Evacuate to < X mbar (or purge with Ar to O2 < Y ppm)
Step 3: Ramp to stress relief temp at Z °C/min
Step 4: Hold at T1°C ± ΔT for t1 hours
Step 5: Cool at W °C/min to T2°C (or furnace cool)
Step 6: [If HIP] Transfer to HIP unit
Step 7: Ramp to T3°C at Z2 °C/min under P MPa Ar
Step 8: Hold T3°C / P MPa for t3 hours
Step 9: Cool under pressure to T4°C, then depressurize
Step 10: [If solution + age] Continue with STA cycle...
Step 11: Record: furnace chart, part/coupon IDs, any deviations
```

### D.7 Surface Finishing SOP

| Step | Method                        | Parameters                                                                                     |
| ---- | ----------------------------- | ---------------------------------------------------------------------------------------------- |
| 1    | Bead blasting                 | Media: glass bead / Al2O3, mesh: 80-120, pressure: 2-4 bar, distance: 100-200mm, angle: 45-90° |
| 2    | Tumbling (if needed)          | Media type, speed, duration                                                                    |
| 3    | Chemical etching (if needed)  | Solution, concentration, temperature, duration                                                 |
| 4    | Polishing (critical surfaces) | Grit sequence: 120→240→400→800, compound                                                       |
| 5    | Cleaning                      | Ultrasonic bath, solvent, duration                                                             |
| 6    | Measurement                   | Ra measurement at specified locations                                                          |

### D.8 Machining SOP

| Item                   | Specification                                         |
| ---------------------- | ----------------------------------------------------- |
| Stock allowance        | Per-surface table from Ch5 (typically 0.3-1.0mm)      |
| Fixture concept        | Soft jaws / custom fixture / vacuum table             |
| Datum surfaces         | Reference from Ch12.1 orientation                     |
| Operations sequence    | Face → bore → profile → finish                        |
| Cutting parameters     | Speed (m/min), feed (mm/rev), DOC (mm) — per material |
| Coolant                | Flood / MQL / dry (material-dependent)                |
| In-process measurement | CMM check after roughing, before finishing            |

---

## Appendix E: Inspection Templates

### E.1 Incoming Powder Inspection Record

| Field                    | Value | Spec | Pass/Fail              |
| ------------------------ | ----- | ---- | ---------------------- |
| Lot #                    |       |      |                        |
| D10 (um)                 |       | X-Y  |                        |
| D50 (um)                 |       | X-Y  |                        |
| D90 (um)                 |       | X-Y  |                        |
| Flowability (s/50g)      |       | < X  |                        |
| Apparent density (g/cm3) |       | > X  |                        |
| Moisture (ppm)           |       | < X  |                        |
| Disposition              |       |      | Accept / Reject / Hold |

### E.2 First Article Inspection (FAI) Record

Based on AS9102 format:

| Char # | Dimension         | Nominal | Tolerance | Measured | Result |
| ------ | ----------------- | ------- | --------- | -------- | ------ |
| 1      | Overall length    | Xmm     | +/- Y     |          | P/F    |
| 2      | Critical bore dia | Xmm     | +/- Y     |          | P/F    |
| ...    | ...               | ...     | ...       | ...      | ...    |

GD&T items:
| Char # | Feature | Tolerance | Datum | Measured | Result |
|--------|---------|-----------|-------|----------|--------|
| N | Flatness of face A | 0.05mm | - | | P/F |
| N+1 | Position of bore B | 0.1mm | A, B, C | | P/F |

### E.3 Dimensional Inspection Plan

| Surface/Feature  | CTQ? | Method         | Points | Frequency     |
| ---------------- | ---- | -------------- | ------ | ------------- |
| Critical face A  | Yes  | CMM            | 25     | Every part    |
| Bore B           | Yes  | CMM/bore gauge | 12     | Every part    |
| Overall envelope | No   | CMM            | 50     | First 5 parts |
| Wall thickness   | Yes  | UT             | 10     | Every part    |

Datum scheme: Primary (A), Secondary (B), Tertiary (C) — with diagram.

---

## Appendix F: Build Record Template

See Chapter 14.3 for the template fields. This appendix provides a printable/fillable
form version for shop floor use.

---

## Build Package CSS

Uses the same base CSS as PPP Report (from report-template.md) with additions:

```css
.sop {
  background: #e3f2fd;
  border-left: 4px solid #1565c0;
  padding: 14px 16px;
  margin: 14px 0;
  border-radius: 0 6px 6px 0;
}
.sop-title {
  color: #0d47a1;
  font-weight: 700;
  font-size: 11pt;
  margin-bottom: 8px;
}
.sop ol {
  counter-reset: sop-step;
  list-style: none;
  padding-left: 0;
}
.sop ol li {
  counter-increment: sop-step;
  padding: 4px 0 4px 36px;
  position: relative;
}
.sop ol li::before {
  content: "Step " counter(sop-step);
  position: absolute;
  left: 0;
  color: #1565c0;
  font-weight: 600;
  font-size: 9pt;
}

.checkpoint {
  background: #fff3e0;
  border: 1px solid #ff9800;
  padding: 8px 12px;
  border-radius: 4px;
  margin: 8px 0;
  font-size: 9pt;
}
.checkpoint::before {
  content: "CHECKPOINT: ";
  font-weight: 700;
  color: #e65100;
}

.warning {
  background: #ffebee;
  border: 1px solid #f44336;
  padding: 8px 12px;
  border-radius: 4px;
  margin: 8px 0;
  font-size: 9pt;
}
.warning::before {
  content: "WARNING: ";
  font-weight: 700;
  color: #c62828;
}

.record-field {
  background: #f5f5f5;
  border: 1px dashed #9e9e9e;
  padding: 6px 10px;
  margin: 4px 0;
  min-height: 20px;
}
```
