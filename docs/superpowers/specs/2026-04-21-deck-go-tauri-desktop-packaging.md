# Deck Go Stage 2 Tauri Desktop Packaging Spec

## Purpose

Define the first desktop packaging baseline for Stage 2.

## Desktop Baseline

- Tauri 2 is the desktop shell
- React + Vite UI is packaged by Tauri
- `controld` is launched as a local sidecar process

## Sidecar Model

### Tauri owns

- launching `controld`
- supervising the sidecar lifecycle
- storing desktop-local preferences
- OS integration features when needed

### Tauri does not own

- runtime protocol adaptation
- business logic
- canonical event mapping

Those remain backend concerns inside `controld`.

## Runtime Operating Modes

### First Stage 2 desktop delivery

- must support connecting to an existing local runtime
- must support connecting to a remote runtime
- does **not** require launch/stop supervision of an OpenClaw runtime itself

### Deferred

- local OpenClaw runtime start/stop from the desktop shell
- deeper OS-coupled runtime management features

## Config / Auth Baseline

- desktop persists control-plane preferences locally
- runtime connection profile remains explicit
- auth/bootstrap must work for both local-runtime and remote-runtime connection
  modes

## Acceptance

- desktop packaging does not move runtime-facing logic out of Go
- desktop delivery does not require a browser-only compromise
- local vs remote runtime modes are explicit for the first cutover
