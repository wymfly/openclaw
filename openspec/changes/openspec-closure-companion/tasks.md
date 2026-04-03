## 1. Define the portable closure protocol

- [ ] 1.1 Define the stable `scenario_id` rules, including how active scenarios are enumerated and how wording-only edits preserve identity
- [ ] 1.2 Define the machine-readable verification artifact schema, including required fields, status vocabulary, and evidence references
- [ ] 1.3 Define the closure gap taxonomy and `archiveReady` semantics for zero-gap versus open-gap changes

## 2. Build the standalone closure companion

- [ ] 2.1 Implement a standalone companion command set that can initialize verification state, run closure checks, and emit closure reports without patching upstream OpenSpec or superpowers workflow files
- [ ] 2.2 Implement parsers for spec scenario inventory, plan coverage mappings, and verification artifact state using `scenario_id` as the stable join key
- [ ] 2.3 Add fixture-driven tests for missing mapping, missing verification entry, `spec-fix-required`, deferred verification, and zero-gap readiness

## 3. Add the project adapter layer

- [ ] 3.1 Define a thin project adapter configuration format for locating plans, verification artifacts, and project-specific strictness rules
- [ ] 3.2 Provide a reference adapter for the current repository without modifying `.claude/commands/opsx/*` or global superpowers skills
- [ ] 3.3 Document how other OpenSpec + superpowers projects install the companion and provide only thin configuration

## 4. Pilot the closure workflow

- [ ] 4.1 Apply the protocol to at least one active change and generate its initial verification artifact from spec inventory
- [ ] 4.2 Run the closure companion against that change and validate that the reported gaps match human review expectations
- [ ] 4.3 Document the recommended lifecycle as `propose -> plan -> apply -> closure check -> archive`
