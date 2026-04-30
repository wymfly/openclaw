import { expect } from "vitest";
import { toHaveNoViolations } from "vitest-axe/matchers";
import "vitest-axe/extend-expect";

// vitest-axe v0.1.0 ships a d.ts that re-exports `toHaveNoViolations` via an
// aliased re-export (`t as toHaveNoViolations`) which TypeScript misclassifies
// as a type-only export under `isolatedModules`. The runtime is a real
// function — verified in `node_modules/vitest-axe/dist/matchers.js`.
// @ts-expect-error — vitest-axe matcher d.ts alias quirk
expect.extend({ toHaveNoViolations });
