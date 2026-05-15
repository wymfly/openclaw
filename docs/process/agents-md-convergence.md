# AGENTS.md Convergence Guide

## Purpose

The root `AGENTS.md` is intentionally more than a normal repository guide. It
teaches agents the project rules, the development workflow, and the owner/agent
collaboration model. That extra context helps a fresh session ask better
questions, choose the right skill, verify work honestly, and improve the process
instead of only editing code.

The long-term goal is not to make the root guide tiny. The goal is to keep only
startup-critical guidance in root context, while moving deep details to
documents, durable project context, or reusable skills.

## Current Rationale

The root guide currently combines three layers:

- Project rules: repository layout, deck-go as the current mainline,
  architecture boundaries, contract authorities, verification commands, and
  safety constraints.
- Development workflow: when to use brainstorming, grill-with-docs, planning,
  TDD, diagnosis, verification, review, handoff, and OpenSpec.
- Collaboration model: the owner states product intent and judges acceptance;
  the agent translates intent into engineering design, asks questions, updates
  context, verifies evidence, and reflects on process gaps.

This makes the file longer than a typical `AGENTS.md`, but the length has a
purpose: it gives a new session enough operating context to behave as a
project teammate instead of a code-editing utility.

## Future Extraction Strategy

When the rules stabilize, converge the root guide by moving detail according to
how often it must be present in first context.

### Keep In Root AGENTS.md

Keep only guidance that must be loaded immediately in every session:

- Role model and owner/agent responsibility split.
- Default language and file-reference rules.
- Current mainline and high-risk legacy boundaries.
- Skill routing and conflict resolution.
- Hard safety rules for dependencies, secrets, destructive git operations, and
  external writes.
- Pointers to the documents or skills that own detailed workflows.

### Keep In CONTEXT.md

Use `CONTEXT.md` for durable project truth:

- Domain terms such as OpenClaw, Gateway, deck-go, runtime, control, and deck RPC.
- Long-lived rules such as Gateway extension boundaries and runtime-mode
  boundaries.
- Resolved ambiguities that affect future design decisions.
- Source-truth rules that are project-specific rather than generic workflow
  instructions.

### Move To docs/process

Use `docs/process/` for project-specific workflow detail that is important but
not needed in the first prompt:

- OpenSpec governance for this repository.
- Contract-chain validation patterns.
- Mock versus real E2E standards.
- External review handling.
- Follow-up inbox and process reflection rules.
- Handoff document templates that are project-specific.

Root `AGENTS.md` should link to these documents instead of restating them in
full.

### Convert To Skills

Convert a workflow into a skill when it is reusable beyond this repository or
when the rule is procedural enough that an agent should execute it step by step.

Good candidates:

- Engineering brainstorming for large new projects or module rewrites.
- Contract-chain source-truth checks.
- Real E2E environment preparation and validation.
- Process reflection after repeated failures or flow defects.
- Review intake and finding reconciliation.

Do not convert one-off project facts into skills. Keep those in `CONTEXT.md` or
project docs.

## Practical Rule

Before adding a large new section to root `AGENTS.md`, ask:

1. Does a fresh session need this before doing anything safely?
2. Is this a project truth, a workflow, or a temporary note?
3. Could an existing skill own the procedure?
4. Could root `AGENTS.md` link to a document instead of embedding the details?

If the answer is "not needed immediately", prefer `CONTEXT.md`,
`docs/process/`, or a skill over expanding root context.
