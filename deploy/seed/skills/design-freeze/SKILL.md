---
name: design-freeze
description: "Use when a complex project is too ambiguous for OpenSpec or implementation planning: core concepts are still shifting, brainstorming produced only a rough design, product and architecture may conflict, or the system needs a frozen baseline before any proposal or plan is written."
---

# Design Freeze

## Overview

Freeze a complex system into a stable design baseline before writing OpenSpec proposals or implementation plans.

This skill exists for the stage between `brainstorming` and `openspec`: when the project direction is real, but the system is not yet precise enough to implement.

## When This Skill Is Mandatory

Use this skill when any of these are true:

- the project is greenfield or architecture-heavy
- one brainstorming pass is not enough to freeze the system
- the model is still shifting during discussion
- the AI is at risk of filling gaps with familiar but wrong patterns
- OpenSpec would be premature because the system identity is not stable yet
- writing a plan now would lock in the AI's guess instead of the user's real intent

Do not use this skill when:

- the task is already a narrow, well-scoped change
- the system model is already stable and only needs an incremental proposal
- the work is a small bugfix or obvious extension of an existing pattern

## Decision Rule

```text
rough idea
  -> brainstorming
  -> if core system model still unstable: design-freeze
  -> if freeze gate passes: openspec or planning
```

If the project still contains unresolved contradictions, do not proceed to OpenSpec.

## Workflow

### Step 1: Build the contradiction list

Collect the current design inputs and identify what is still ambiguous or contradictory.

Look for conflicts between:

- product intent and architecture
- ownership and permission models
- runtime reality and governance claims
- resource model and collaboration model
- routing model and entry experience
- old code assumptions and new design claims

### Step 2: Resolve one core ambiguity at a time

Do not try to freeze the whole system in one pass.

Prioritize this order:

1. What the system is
2. Core entities and ownership
3. Entry and routing rules
4. Resource and permission boundaries
5. Runtime and control-plane boundaries
6. Lifecycle and state transitions
7. Data model and module boundaries
8. Acceptance criteria

### Step 3: Rewrite the baseline after each clarification

After each resolved ambiguity:

- restate the model in concrete terms
- check whether any earlier section is now contradicted
- delete obsolete assumptions explicitly
- keep only one active model for each core concept

### Step 4: Produce a freeze pack, not a single design note

For complex systems, the output is a document set, not one markdown file.

Use [references/freeze-pack.md](references/freeze-pack.md) for the standard artifact set and exit gate.

### Step 5: Stop only at the freeze gate

Do not exit this skill when the design merely sounds good.

Exit only when:

- the core concepts are stable
- product and architecture no longer contradict each other
- the main runtime and governance boundaries are explicit
- schema and module boundaries are frozen to `v1` level
- acceptance is defined as journeys plus system assertions

## Handoff

Once the freeze gate passes:

- create one active OpenSpec change for the first slice
- keep the freeze pack as the long-term baseline
- let the change describe only the next increment
- only then move to `writing-plans`

## Red Flags

- jumping from brainstorming straight to OpenSpec
- writing tasks before the system identity is stable
- keeping two competing ontology models alive
- letting AI familiarity override the user's domain
- using feature lists as a substitute for acceptance
- treating runtime assumptions as if they were verified architecture
