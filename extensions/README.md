# Extensions

This directory contains bundled OpenClaw plugins. Bundled plugins share the same
plugin contract as third-party plugins: each plugin owns its manifest,
package metadata, runtime entry, local config shape, and optional skills.

For plugin authoring contracts, use the official plugin docs:

- `docs/plugins/building-plugins.md`
- `docs/plugins/architecture.md`
- `docs/plugins/sdk-overview.md`
- `docs/plugins/manifest.md`

## Installation Models

OpenClaw supports two different operational models. Keep them separate.

### Official User Install

Use `openclaw plugins install` when installing a plugin into a normal OpenClaw
runtime or when linking a local plugin for development.

Common commands:

```bash
openclaw plugins install <package>
openclaw plugins install clawhub:<package>
openclaw plugins install ./extensions/<plugin-id>
openclaw plugins install -l ./extensions/<plugin-id>
openclaw plugins install ./plugin.tgz
```

This path installs or links the plugin into the user's plugin install root and
records install metadata under OpenClaw plugin config. It makes the plugin
discoverable, but the plugin still needs to be enabled and configured through
`plugins.entries.<plugin-id>`.

Use `-l` only for development. Production installs should use a copied package,
an archive, or a release artifact.

### Bundled Release Or Hot Install

Bundled plugins ship as part of the OpenClaw runtime tree. In the legacy
Windows deploy package, the active bundled plugin directory is:

```text
source\dist\extensions\<plugin-id>
```

Use this path only when building a release or applying a controlled hot install
to an existing deploy package. For self-developed plugins such as `email` and
`wecom`, follow:

```text
extensions/SELF-DEVELOPED-PLUGIN-DEPLOYMENT.md
```

Do not leave the same plugin id active in both an explicit config load path and
the bundled plugin directory. Duplicate ids can shadow each other and make the
runtime load a stale plugin copy.

## Enablement And Runtime Config

Installation is not enablement.

- Install or bundle the plugin so OpenClaw can discover it.
- Enable it with `plugins.entries.<plugin-id>.enabled`.
- Add plugin-specific config under `plugins.entries.<plugin-id>.config`.
- For channel plugins, also preserve channel runtime config such as
  `channels.<id>`, account data, callbacks, and routing bindings.

For example, `email` is a tool plugin and mainly needs account config under its
plugin entry. `wecom` is a channel plugin and also needs channel/account
runtime configuration.
