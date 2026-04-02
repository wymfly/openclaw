# Freeze Pack

Use this reference when a complex system needs a frozen baseline before OpenSpec.

## Standard Artifact Set

For a complex project, the default freeze pack should include:

1. `system design`
   - What the system is, what it is not, core principles, major modes
2. `canonical model`
   - Core entities, ownership, relationships, invariants
3. `interaction matrix`
   - Entry types, routing behavior, allowed and rejected interactions
4. `runtime model`
   - Control plane vs runtime fact, routing chain, session model
5. `state machines`
   - Lifecycle of the main persistent and runtime objects
6. `schema v1`
   - Minimum database model needed to encode the system truthfully
7. `module contracts`
   - Service boundaries, dependency rules, stale assumptions to remove
8. `acceptance pack`
   - User journeys, system assertions, failure gates, release gate

For smaller systems, some artifacts can be merged, but the concepts must still be covered.

## Freeze Questions

The freeze is not complete until these questions are answered:

1. What is the primary object of the system?
2. What is owned by a user, a team, or the platform?
3. What are the formal entry points?
4. What must the platform decide before handing work to the runtime?
5. What is the truth source at creation time, governance time, and runtime?
6. Which states matter for availability, lifecycle, and cleanup?
7. Which tables or records must exist for the model to remain honest?
8. Which module owns each decision?
9. What does acceptance look like from both user and system perspectives?

## Exit Gate

Do not move to OpenSpec or planning until all of these are true:

- there is one stable ontology for the system
- old competing models are explicitly rejected
- product promises match runtime reality
- permissions and resources are modeled consistently
- routing behavior is explicit and auditable
- schema and modules are defined to `v1` level
- acceptance is written as journeys plus assertions, not just features

## Common Failure Modes

- One-shot brainstorming treated as final architecture
- OpenSpec used to invent the whole system instead of describing one change
- Plans written around AI assumptions rather than validated product semantics
- Old code structure silently dictating the new product model
- Two ownership models mixed in the same design
- Runtime drift or security limits ignored until implementation time
