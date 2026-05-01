import type { RunOptions } from "axe-core";
import { expect } from "vitest";
import { axe, type AxeMatchers } from "vitest-axe";

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion<T> extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}

/**
 * Run axe-core on `container` and assert no violations. Atom tests should call
 * this once with their default rendered output (the simplest happy-path
 * variant). Failures should be triaged: either fix the atom or pass a
 * targeted `options.rules.<id>.enabled = false` override with a justification
 * comment in the calling test.
 */
export async function expectNoAxeViolations(
  container: Element,
  options?: RunOptions,
): Promise<void> {
  const results = await axe(container, options);
  expect(results).toHaveNoViolations();
}
