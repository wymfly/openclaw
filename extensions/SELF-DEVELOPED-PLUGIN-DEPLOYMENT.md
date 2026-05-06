# Self-Developed Plugin Deployment

This note captures the operational path for in-house plugins such as `email`
and `wecom`. The general plugin development docs explain how to write a plugin;
this file explains how to place one into a deployed OpenClaw runtime without
rediscovering the production install details.

## Baseline Model

All native OpenClaw plugins use the same installation shape:

- Source lives under `extensions/<plugin-id>/`.
- The plugin root contains `package.json`.
- The plugin root contains `openclaw.plugin.json`.
- The package `openclaw.extensions` entry points at the runtime entry.
- The runtime enables the plugin through `plugins.entries.<plugin-id>`.

Tool plugins and channel plugins differ only after installation:

- Tool plugins, such as `email`, normally need only
  `plugins.entries.<id>.enabled` and `plugins.entries.<id>.config`.
- Channel plugins, such as `wecom`, also need channel/account/runtime
  configuration, for example `channels.wecom` and routing or webhook bindings.

## Preferred Path: Build Into The Release

Use the normal release flow whenever possible.

1. Keep the plugin source in `extensions/<id>/`.
2. Keep the manifest and package metadata accurate:
   - `openclaw.plugin.json:id` is the key used in `plugins.entries.<id>`.
   - `package.json:openclaw.extensions` points at the source entry during
     development.
3. Run the plugin's focused tests, for example:

   ```bash
   pnpm test extensions/email/src/runtime.test.ts
   ```

4. Build/package OpenClaw through the normal deploy release flow.
5. Deploy the resulting package so the plugin arrives as part of the runtime
   tree under `source/dist/extensions/<id>`.

This keeps the plugin entry, hashed build chunks, SDK subpaths, and runtime
dependencies from the same build. That is the safest production path.

## Hot Installing Into A Legacy Windows Deploy

Use this only for a targeted server update when a full deploy package is not
being regenerated.

The legacy Windows deploy runtime discovers bundled plugins from:

```text
<install-root>\source\dist\extensions\<plugin-id>
```

Do not rely on copying only `extensions/<id>` source into the install root.
That source tree is useful for reference, but the deployed Gateway normally
loads from `source/dist/extensions`.

### Preflight

Before touching the server, collect evidence:

- `GET /`
- `GET /api/gateway/health`
- `GET /api/gateway/status`
- `GET /api/channels` when channel health matters
- Scheduled Task status for the deploy service
- Current config hash for `data\.openclaw\openclaw.json`

Create backups before any write:

- `data\.openclaw\openclaw.json`
- existing `source\dist\extensions\<id>`, if present
- any temporary source copy you plan to remove later

### Build The Hot-Install Artifact

A raw `dist/extensions/<id>` directory may import root-level hashed chunks such
as `../../text-runtime-*.js`. That is only safe if the server has the exact same
build output.

For a hot install into an older deployed runtime, prefer a standalone plugin
entry:

```bash
pnpm exec esbuild extensions/email/index.ts \
  --bundle \
  --platform=node \
  --format=esm \
  --target=node22 \
  '--external:openclaw/plugin-sdk/*' \
  --outfile=/tmp/openclaw-email-plugin/index.js
```

Then package:

- `index.js`
- `openclaw.plugin.json`
- `package.json` with `openclaw.extensions: ["./index.js"]`
- plugin `skills/`, if the plugin ships skills
- other non-code runtime assets required by the plugin

The standalone entry should externalize only stable runtime surfaces already
present on the server, normally `openclaw/plugin-sdk/*` and Node built-ins.

### Install Files

On the Windows host:

1. Extract the artifact to a temporary directory.
2. Verify required files exist:
   - `index.js`
   - `openclaw.plugin.json`
   - `package.json`
3. Replace or create:

   ```text
   <install-root>\source\dist\extensions\<plugin-id>
   ```

4. Avoid leaving a duplicate plugin copy under another active discovery root.

## Configuration

Enable every plugin through `plugins.entries.<id>`.

For a tool plugin such as `email`:

```json
{
  "plugins": {
    "entries": {
      "email": {
        "enabled": true,
        "config": {
          "defaultAccountId": "work",
          "accounts": [
            {
              "id": "work",
              "host": "imap.example.com",
              "port": 993,
              "secure": true,
              "user": "user@example.com",
              "password": { "env": "EMAIL_IMAP_PASSWORD" },
              "mailbox": "INBOX",
              "smtp": {
                "host": "smtp.example.com",
                "port": 587,
                "secure": false,
                "startTls": true,
                "user": "user@example.com",
                "password": { "env": "EMAIL_SMTP_PASSWORD" },
                "from": "user@example.com"
              }
            }
          ]
        }
      }
    }
  }
}
```

Use placeholder config only to verify plugin loading. Real IMAP/SMTP usability
requires real account credentials.

For a channel plugin such as `wecom`, plugin enablement is not enough. Keep the
channel runtime config as well:

```json
{
  "plugins": {
    "entries": {
      "wecom": {
        "enabled": true,
        "config": {}
      }
    }
  },
  "channels": {
    "wecom": {
      "enabled": true
    }
  }
}
```

The actual WeCom production config also includes account, agent or bot,
webhook, secret, and routing/binding details. Do not overwrite those during a
plugin install.

## Restart And Reattach

Changing `plugins.entries` or plugin files can require a Gateway restart.

For the legacy Windows deploy:

1. Stop/start the deploy service or trigger `OpenClaw Deploy Current`.
2. Wait for the full Gateway startup window, often 50-80 seconds.
3. Verify `localhost:19040/healthz`.
4. Verify `localhost:3340/api/gateway/health`.
5. If Deck returns `500` or `502` while Gateway itself is healthy, replay Deck
   runtime settings with the configured Gateway URL and token.
6. Start `OpenClawReleaseHTTP` if the release HTTP port is also expected to be
   online.

## Verification Checklist

Minimum plugin verification:

- Gateway health returns `200`.
- Gateway logs contain a current ready line with the plugin id, for example:

  ```text
  [gateway] ready (... plugins: ..., email, ..., wecom; ...)
  ```

- No plugin load failure appears after the latest ready line.
- `openclaw plugins list` shows the plugin discovered from
  `stock:<id>/index.js`.

For tool plugins:

- The plugin is loaded or discovered as expected.
- Placeholder config is clearly marked if real credentials are not yet present.
- Real tool calls are tested after credentials are added.

For channel plugins:

- `GET /api/channels` shows the channel.
- The channel reports `running=true`.
- The channel reports `health=healthy`.
- Account-level fields such as `connected` and `authenticated` are true when
  the channel supports them.

## Recovery

If the plugin fails to load:

1. Check whether `source\dist\extensions\<id>\index.js` imports missing hashed
   chunks such as `../../*.js`.
2. Replace the plugin with a standalone entry, or deploy a full matching build.
3. If service health is affected, restore the backed-up plugin directory and
   `openclaw.json`.
4. Restart Gateway and re-run the verification checklist.

Keep the backup directory names in the final deployment note so the next
operator can roll back without searching shell history.
