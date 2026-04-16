# Validated OpenClaw Deploy Release Flow

## Scope

This reference documents the validated packaging and deployment flow used for the OpenClaw deploy release host.

Current validated host profile:

- Host: `60.204.148.217`
- Working root: `D:\openclaw`
- Windows node_modules source: `D:\openclaw\source\node_modules`
- Release HTTP port: `8088`

## Artifact types

### Base tarball

Produced locally from the repo. Contains:

- `source/`
- prebuilt Gateway `dist/`
- prebuilt Deck standalone output
- deploy scripts
- bootstrap assets when `--bootstrap-base-url` is used

It does **not** normally contain `source/node_modules`.

### Windows self-contained package

Produced on a Windows host from the base tarball plus Windows `source/node_modules`.

This is the package Windows end users should install or update from.

## Local packaging

Build the base tarball locally:

```bash
deploy/scripts/package.sh --with-prebuilt --bootstrap-base-url http://<host>:8088/<release-label> --output /tmp/openclaw-deploy-release
```

Alternative when packaging directly on a matching Windows environment:

```bash
deploy/scripts/package.sh --windows-self-contained --bootstrap-base-url http://<host>:8088/<release-label> --output /tmp/openclaw-deploy-release
```

## Upload to the Windows release host

Example staging layout:

- `D:\openclaw\publish\latest\` for the base tarball
- `D:\openclaw\publish\<release-label>\` for final user-facing release artifacts

## Windows self-contained packaging on the host

Use the PowerShell augmenter on the Windows host:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\package-self-contained.ps1 `
  -BasePackage D:\openclaw\publish\latest\openclaw-deploy-<stamp>.tar.gz `
  -NodeModulesPath D:\openclaw\source\node_modules `
  -OutputDir D:\openclaw\publish\<release-label> `
  -BootstrapBaseUrl http://<host>:8088/<release-label> `
  -Force
```

Final output should include:

- `install.ps1`
- `windows-latest.json`
- `openclaw-deploy-<stamp>-windows-selfcontained.tar.gz`

## User install/update entrypoint

Windows users should use the published bootstrap:

```powershell
iwr -useb http://<host>:8088/<release-label>/install.ps1 | iex
```

Repeated execution should act as update.

## Validation checklist

### Fresh install

Use an isolated root and custom ports. Example pattern:

- Root: `D:\openclaw\selftest-<label>`
- Gateway port: a unique port such as `19040`
- Deck port: a unique port such as `3340`
- Startup task name: unique per test

Validate:

- `Gateway=200`
- `Deck=200`
- `status.ps1` reports config present

### Update + data preservation

Before update:

- Record SHA256 of `data\.openclaw\openclaw.json`
- Create a workspace sentinel like `data\.openclaw\workspace\user-sentinel.txt`
- Create a Deck sentinel like `data\openclaw-deck\user-sentinel.json`

After update, verify:

- Gateway and Deck return HTTP 200
- `openclaw.json` hash is unchanged unless the release intentionally changed it
- workspace sentinel still exists with the same content
- deck sentinel still exists with the same content

## Cleanup checklist

Before cleanup:

- Decide which install root remains as the healthy service
- Confirm that service is healthy with HTTP probes and `status.ps1`

Keep:

- One final publish directory (for example `final-taskfix3`)
- The Windows `source` checkout if it is still needed to generate future self-contained packages
- One healthy installed service root

## Release HTTP service

Serve `D:\openclaw\publish\` on an **independent static HTTP port** instead of reusing Deck's `3340` or default `80/443`.

Recommended command on Windows:

```powershell
cd deploy
.\serve-release-http.cmd
```

Validated endpoint shape:

```text
http://<host>:8088/<release-label>/install.ps1
```

Remove:

- Old `selftest-*` roots not being kept
- `.update-*`, `.rollback-*`, `.normalize-*` staging directories
- scratch scripts and logs in `D:\openclaw\publish\` that are not release artifacts
- broken or obsolete startup-task entries tied to deleted test installs

## Post-deploy status maintenance

After any deploy, publish, validation, or rollback step that changes the current truth, update `deploy/STATUS.md`.

Minimum fields to refresh:

- latest backup path
- current live app root
- current live task names and ports
- current publish directory
- user install/update command
- external verification results
- whether the public package is fully current or still pending refresh

## Current validated result to preserve

The validated user requirement is:

- self-contained Windows package installs successfully
- self-contained Windows package updates successfully
- update preserves user data and config

Do not regress that flow when cleaning up or preparing the next release.
