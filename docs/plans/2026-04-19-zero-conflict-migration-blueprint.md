# Zero Conflict Migration Blueprint

## Goal

Define the only credible path to drive recurring upstream merge conflicts on the `enhanced` branch close to zero while preserving the fork's core product value.

This document is not about ideal elegance. It is about maintenance economics.

## Baseline Reality

Today the fork's conflict pressure is driven by one structural fact:

- Deck capabilities are implemented by modifying upstream owned OpenClaw core files in active areas such as `src/gateway/**`, `src/plugins/**`, `src/config/**`, and chat or transcript paths.

As long as Deck depends on patching those files, rebases will continue to cost time.

Therefore:

- conflict reduction is not mainly a git workflow problem
- conflict reduction is mainly a boundary placement problem

## Non Negotiable Constraint

If the target is literal zero recurring core conflicts, then every fork specific behavior must satisfy one of these conditions:

1. it is accepted upstream
2. it is removed from shared core files and implemented in a fork owned seam

There is no third path.

## The Three Strategic Options

### Option A. Continue patching core and just get better at rebasing

Description:

- Keep `deck.*` RPCs in core
- Keep protocol schemas and method metadata in core
- Keep plugin metadata shaping in core
- Keep transcript and event stream shaping in core
- Improve documentation and conflict playbooks only

Benefits:

- fastest short term product velocity
- least architectural change
- no intermediate degradation risk

Costs:

- recurring rebase cost remains high
- semantic conflicts remain concentrated in the same upstream hot files
- every upstream refactor still requires fork specific repair

Expected conflict outcome:

- lower pain, not low conflict

Verdict:

- not compatible with a zero conflict target

### Option B. Push as much compromise as possible into Deck frontend only

Description:

- try to stop changing OpenClaw core
- make Deck UI compensate for missing upstream abstractions
- let frontend normalize transcripts, auth views, plugin metadata, and event behavior

Benefits:

- sharply reduces some core churn
- keeps fork specific UX logic out of upstream files

Costs:

- frontend becomes overloaded with responsibilities that are not naturally UI concerns
- browser must reconstruct state from incomplete upstream APIs
- auth, model provenance, plugin setup metadata, and transcript shaping become harder to trust
- more duplicated logic between frontend and runtime
- harder integration testing and weaker consistency guarantees

Expected conflict outcome:

- medium to low conflict, but with product quality loss and growing frontend complexity

Verdict:

- better than core patching everywhere
- still not the best architecture
- only acceptable if you are willing to lose precision and increase UI fragility

### Option C. Move compromise into a Deck owned adapter layer

Description:

- upstream OpenClaw provides generic runtime capabilities
- a Deck owned adapter or sidecar composes, reshapes, enriches, and stabilizes those capabilities for Deck
- Deck frontend consumes the adapter's stable contract

Benefits:

- removes most fork specific logic from upstream hot files
- keeps UI thin enough to stay maintainable
- preserves rich Deck behavior without requiring upstream to adopt Deck as product scope
- gives a dedicated place to encode fork specific policy, metadata, and compatibility logic

Costs:

- adds one more subsystem
- requires explicit contract design and migration work
- some capabilities become eventual or projected views instead of source of truth views
- new test surface between upstream runtime and Deck adapter

Expected conflict outcome:

- the only realistic path to near zero recurring conflicts without deleting Deck capabilities

Verdict:

- best strategic option

## Bottom Line

If the objective is to minimize future conflicts while keeping Deck strong, the right answer is not "put all the pain into the frontend".

The right answer is:

- put generic improvements upstream
- put fork specific projection logic into a Deck owned adapter
- keep the frontend mostly declarative

That is the best maintenance boundary.

## What "Put The Compromise In Deck" Actually Means

There are two different interpretations:

### Bad interpretation: put it all in the browser

This means:

- frontend reads raw upstream responses directly
- frontend guesses provider provenance
- frontend reconstructs transcript shape
- frontend hardcodes plugin setup metadata rules
- frontend filters event streams locally

Why this is bad:

- too much business logic in the UI
- weak correctness and debuggability
- large React store complexity
- duplicated interpretation logic across screens

### Good interpretation: put it in Deck owned server side infrastructure

This means:

- a Deck adapter composes upstream API output into Deck ready resources
- auth and model provenance are computed server side
- transcript normalization happens before UI consumption
- plugin metadata is built from Deck owned generated artifacts
- event filtering becomes an adapter concern, not a core concern

Why this is good:

- conflict pressure moves out of upstream core
- correctness stays in a backend style layer
- UI remains simpler

## Target Architecture

The target architecture should become:

1. Upstream OpenClaw runtime
   Provides generic agent, session, plugin, config, and Gateway execution surfaces.
2. Deck adapter
   A fork owned service or process layer that enriches upstream data for Deck.
3. Deck frontend
   Consumes stable adapter APIs and renders the management experience.

In shorthand:

- OpenClaw = execution engine
- Deck adapter = projection and compatibility layer
- Deck frontend = interface

## Capability Placement Rules

To maintain near zero conflict over time, use these rules.

### Must live upstream or be upstreamable

- generic method registry
- generic `gateway.describe`
- generic method result schemas
- generic bundled plugin compatibility fixes
- generic Windows service reliability fixes
- generic media robustness

### Must move to Deck adapter

- provider provenance
- auth overview and auth probe aggregation
- transcript canonicalization for UI readability
- event stream filtering for Deck subscribers
- Deck specific plugin metadata projection
- Deck capability gap analysis and protocol coverage reporting
- Deck specific command discovery projections

### Must not remain in shared core files unless upstream accepts them

- `deck.*` RPC namespace registration
- Deck only schema files in core protocol bundles
- Deck specific manifest extensions in generic plugin manifest types

## The Real Tradeoffs

If you pursue zero conflict, you will give up some things.

### What you sacrifice

- immediate convenience of patching core once and using the result everywhere
- perfect source of truth alignment for some Deck views
- some raw runtime performance due to an extra projection step
- simplicity of the current "local Gateway contains every Deck specific behavior" story

### What you gain

- drastically lower rebase and conflict repair cost
- clearer ownership boundaries
- easier reasoning about which code belongs to upstream versus fork
- less fear when following upstream closely
- more freedom to evolve Deck independently

### What may degrade temporarily during migration

- some management pages may need to fall back to partial or computed views before the adapter is complete
- some real time streams may become less fine grained until a stable adapter event model exists
- some setup flows may become slower if they move from direct core hooks to generated metadata plus adapter orchestration

## Migration Principle

Do not try to achieve zero conflict by a giant rewrite.

Instead:

- first eliminate the highest conflict surfaces
- then narrow the remaining fork patch area
- then decide whether the residual fork only control plane is worth keeping in core

## Recommended Phases

### Phase 1. Upstream the generic protocol foundation

Primary goal:

- make the generic registry and introspection infrastructure stop being a fork only patch

Actions:

- upstream `MethodRegistry`
- upstream `gateway.describe`
- upstream non Deck method metadata and result schemas where possible

Why first:

- this removes the highest leverage structural divergence
- it gives the adapter a stable discovery surface

Expected effect:

- major conflict reduction in `src/gateway/protocol/**` and registration paths

### Phase 2. Externalize Deck protocol tooling

Primary goal:

- stop keeping Deck generator logic in shared core ownership

Actions:

- move protocol codegen into Deck owned tooling
- generate from `gateway.describe` or exported method metadata snapshots
- keep coverage and gap reports in the Deck repository or Deck tooling area

Expected effect:

- less churn in `scripts/**`
- cleaner division between runtime and client build tooling

### Phase 3. Move plugin metadata projection out of core

Primary goal:

- stop expanding shared plugin manifest and loader paths for Deck only metadata

Actions:

- replace generic `deck.setupWizardSpec` style manifest changes with a Deck side companion registry or generated artifact
- let build time tooling assemble Deck plugin metadata from plugin sources
- keep OpenClaw plugin manifest generic

Expected effect:

- reduced conflict pressure in `src/plugins/**` and `src/channels/plugins/**`

### Phase 4. Build the Deck adapter

Primary goal:

- create a proper home for Deck specific projections

Minimum adapter responsibilities:

- provider provenance
- auth overview and probe orchestration
- transcript shaping and tool payload normalization
- plugin setup metadata materialization
- event filtering and projection

Expected effect:

- the fork stops needing to patch core for management view concerns

### Phase 5. Shrink or remove `deck.*` from core

Primary goal:

- make `deck.*` no longer require direct edits in shared upstream registration files

Possible end states:

- adapter exposes its own HTTP or WebSocket namespace
- Gateway supports a plugin or extension registration seam and Deck uses that
- some `deck.*` capabilities disappear because the adapter can answer them without core support

Expected effect:

- only small residual fork patches remain
- this is the final step needed for true near zero conflict

## Recommended End State For Each Major Current Change Group

### Protocol registry and method metadata

- preferred end state: upstream

### Protocol code generation

- preferred end state: Deck tooling

### Deck auth and provider observability

- preferred end state: Deck adapter

### Transcript canonicalization and whitebox shaping

- preferred end state: Deck adapter

### Event stream filtering

- preferred end state: Deck adapter or Deck side filtering

### Plugin setup metadata and wizard projection

- preferred end state: Deck generated registry artifact plus adapter

### Deck specific RPC namespace

- preferred end state: adapter namespace or pluginized host seam, not shared core registration

## What Happens If You Put More Compromise In Deck

If you move more compromise into Deck owned layers, three things happen.

### Positive

- rebases get cheaper
- upstream upgrades get less scary
- fork specific behavior becomes easier to reason about

### Negative

- Deck team owns more complexity
- there is more product logic outside the runtime engine
- some features become projections over upstream state rather than native runtime features

### Neutral but important

- the complexity does not disappear
- it only changes ownership

This is why the decision is not "complexity or no complexity".

The decision is:

- do you want the complexity inside upstream conflict zones
- or inside a fork owned boundary you control

For maintenance, the second answer is better.

## Sharp Recommendation

If the project is serious about driving conflict pressure toward zero:

1. upstream the generic protocol and schema infrastructure
2. stop extending generic plugin and Gateway surfaces for Deck only needs
3. build a Deck adapter and move projection logic there
4. keep the frontend thin
5. remove the remaining Deck specific registrations from shared core files

## What Not To Do

Do not pursue these paths if the goal is low conflict:

- do not keep adding Deck specific schema or method wiring to upstream hot files
- do not make the React frontend the source of truth for auth, transcript, or plugin setup interpretation
- do not assume better rebase discipline alone will solve a boundary problem

## Final Judgment

Yes, moving the compromise away from OpenClaw core is the better strategy.

But the compromise should mostly move into a Deck owned adapter layer, not into the frontend alone.

If you push the complexity into the browser, you reduce some conflicts but increase product fragility.

If you push the complexity into a Deck owned backend style seam, you get the better trade:

- lower conflict
- higher correctness
- clearer ownership
- better long term maintenance

That is the architecture most consistent with a near zero conflict objective.
