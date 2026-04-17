/**
 * Access descriptor registration barrel.
 *
 * PR #1 ships empty by design — the contract scaffold (types, registry,
 * AccessPanel, hooks stub) is in place but no descriptors are registered yet.
 *
 * PR #2 will add a side-effect import:
 *   import "./wecom-access-descriptor";
 *
 * Deck's top-level providers file must also import this barrel as a
 * side-effect so descriptor registrations run before any consumer mounts.
 */
