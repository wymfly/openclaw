# OpenClaw Enhancement Decision Matrix

## Purpose

This note turns the plugin-versus-core discussion into a reusable decision aid.

Use it before implementing any OpenClaw enhancement so the default path is:

- plugin first
- core only when runtime truth or a generic kernel seam is actually required

## Core Rule

Default posture:

- if the change is capability-owned, integration-owned, or feature-owned, build it as a plugin
- if the change alters runtime truth, shared host semantics, or a generic kernel seam, change core
- if the change starts plugin-local but clearly has multiple consumers, extract a generic SDK seam after the second real consumer appears

In short:

- plugin first
- shared seam second
- core last

## Decision Questions

Ask these in order:

1. Is this runtime truth or runtime effect?
2. Is this capability owned by one provider, channel, or feature?
3. Can manifest metadata and plugin registration express it before runtime executes?
4. Will at least two plugins likely need the same helper or policy?
5. Does the change need to alter a reserved or core-owned namespace?

## Quick Matrix

| Change shape                                                                                                | Default path    | Why                                                                               | Escalate when                                                                             |
| ----------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| New provider, model catalog, provider auth, provider onboarding                                             | Plugin          | Provider ownership already lives in plugin capabilities                           | Multiple providers now need the same transport/payload/replay/tool compat helper          |
| New channel, outbound delivery, threading, session grammar, pairing, DM policy                              | Plugin          | Channel ownership already lives behind `registerChannel(...)`                     | The change needs to alter shared message host semantics or outer session-key truth        |
| New tool, command, hook, service, interactive handler                                                       | Plugin          | These are explicitly registerable plugin surfaces                                 | The tool/command contract becomes globally shared and host-owned                          |
| New web search, web fetch, media understanding, image/music/video generation backend                        | Plugin          | These are explicit capability seams                                               | A generic normalization or transport seam is needed across multiple plugins               |
| New plugin-owned Gateway RPC or HTTP route                                                                  | Plugin          | SDK explicitly supports `registerGatewayMethod(...)` and `registerHttpRoute(...)` | The route or RPC overlaps reserved admin/core namespace or should become platform-generic |
| New setup/onboarding hint, manifest metadata, activation descriptor                                         | Plugin manifest | OpenClaw is manifest-first by design                                              | Metadata is insufficient and a runtime host seam is truly required                        |
| New replay policy, payload normalization, stream wrapper, tool schema compat helper used by several plugins | Shared SDK seam | This is exactly the kind of reusable behavior the boundary docs call out          | The behavior turns out to be runtime truth rather than reusable helper logic              |
| Change to config truth, session effect semantics, runtime protocol authority, shared message host           | Core            | These are runtime/kernel responsibilities                                         | N/A; this is already a core concern                                                       |
| Change to reserved namespaces like `config.*`, `exec.approvals.*`, `wizard.*`, `update.*`                   | Core            | Reserved admin/core namespaces stay core-owned                                    | N/A; plugins should avoid these prefixes                                                  |

## High-Freedom Plugin Zones

These are safe default plugin zones with high freedom:

- provider plugins
- channel plugins
- speech / realtime / multimodal providers
- web search / web fetch providers
- tools
- commands
- hooks
- background services
- Gateway plugin methods
- HTTP routes
- memory capabilities and supplements
- onboarding/setup metadata

Why:

- all are first-class documented registration surfaces
- bundled plugins and third-party plugins are supposed to share the same boundary

## Medium-Freedom Zone: Plugin First, Then Shared Seam

These should usually begin in one plugin, but should not stay duplicated once they become obviously cross-plugin:

- replay policy helpers
- tool schema normalization
- stream wrapper composition
- transport decoration
- payload patch/compat behavior
- setup/runtime helper utilities
- memory host helpers

Recommended rule:

- first consumer: plugin-local
- second real consumer: extract generic helper/SDK seam

Do not:

- copy the same policy into a second plugin and promise to clean it up later

## Low-Freedom / Core-Owned Zone

These remain kernel or runtime concerns and should not be treated as plugin-owned:

- Gateway/runtime protocol truth
- session effect semantics
- config authority
- shared message tool host
- outer session-key and generic thread bookkeeping
- reserved admin/core namespaces
- generic host security and global auth model
- loader/registry/kernel contract rules

If your enhancement touches one of these, you are already in core work.

## Specific Boundary Notes

### Provider work

Prefer plugin-local ownership for:

- auth
- onboarding
- model catalogs
- provider-specific runtime behavior

Prefer shared seam extraction for:

- transport family helpers
- replay policy families
- tool payload compat families

### Channel work

Prefer plugin-local ownership for:

- platform config
- outbound execution
- threading specifics
- session conversation grammar
- pairing and DM policy

Keep core ownership for:

- shared `message` tool host
- prompt wiring
- outer session/thread bookkeeping
- generic dispatch host

### Control-plane metadata

Prefer manifest-first design:

- discovery
- config validation
- setup hints
- onboarding hints
- activation planning

Do not:

- quietly force runtime imports into discovery/setup paths unless absolutely necessary

## Escalation Triggers

Move from plugin work to shared seam or core when one of these becomes true:

- the same helper or policy appears in two plugins
- the behavior must become stable for third-party plugins, not just bundled ones
- the change affects runtime truth rather than plugin-owned behavior
- the feature needs a reserved core namespace
- the plugin needs a host/internal import to function
- cold manifest/setup/discovery paths would need to execute heavy runtime code

## Anti-Patterns

Avoid these:

- core-first implementation for provider/channel/feature-owned behavior
- plugin code importing arbitrary `src/**` internals
- adding private backdoors for bundled plugins that third-party plugins cannot use
- duplicating the same provider/channel policy in multiple plugins
- encoding plugin-owned config reads throughout unrelated core paths
- solving a plugin problem by expanding core when a narrow SDK seam would work

## Verification Checklist

Before choosing a path, verify:

1. The needed capability is not already in `docs/plugins/sdk-overview.md`
2. The change does not violate `src/plugin-sdk/AGENTS.md`
3. The change does not violate `src/plugins/AGENTS.md`
4. The change does not violate `extensions/AGENTS.md`
5. If choosing core, document why plugin + shared seam is insufficient

## Decision Template

Use this template in plans or PR notes:

```md
Enhancement:

Owned by:

Runtime truth change? yes/no

Plugin-first viable? yes/no

Manifest-first viable? yes/no

Likely second consumer? yes/no

Chosen path:

- plugin
- shared seam
- core

Reason:
```

## Bottom Line

For OpenClaw second-stage development, the correct default is:

- treat plugins as the main vehicle for enhancement
- treat core as the kernel and source of runtime truth
- add generic SDK seams only when multiple plugins prove the need

That gives the lowest-intrusion path while staying aligned with the current architecture.
