# Email (plugin)

Bundled OpenClaw-native email plugin for IMAP mailbox access, attachment
automation, and SMTP sending.

This plugin is designed for agent workflows such as:

- searching a configured mailbox by date, sender, recipient, subject, or
  attachment filename
- reading message headers, body previews, and attachment inventories
- downloading one message's attachments by `uid` or `messageId`
- downloading all attachments from matching messages for daily automation
- sending email through SMTP, including file attachments from allowed roots

The plugin is intentionally built with **no new third-party mail dependency**.
The first implementation keeps IMAP, SMTP, MIME parsing, and filesystem safety
inside the plugin so the OpenClaw core stays extension-agnostic.

## Installation And Deployment

For local development, install or link the plugin through the official plugin
CLI:

```bash
openclaw plugins install ./extensions/email
openclaw plugins install -l ./extensions/email
```

The first command copies the plugin into the user's plugin install root. The
second command links the local source tree and should be used only for
development iteration.

Installation only makes the plugin discoverable. The plugin still needs
`plugins.entries.email.enabled` and account config under
`plugins.entries.email.config` before the tools are usable.

For bundled releases or legacy Windows deploy hot installs, do not rely on a
development link. Ship the plugin as part of the release artifact, or follow
the controlled server procedure in:

```text
extensions/SELF-DEVELOPED-PLUGIN-DEPLOYMENT.md
```

Avoid leaving another active `email` copy under `plugins.load.paths` when the
same plugin id is already bundled, because duplicate plugin ids can shadow the
deployed copy.

## Agent Experience

When this plugin is enabled, OpenClaw exposes the email tools through the normal
agent tool surface and loads the plugin skill directory declared in
`openclaw.plugin.json`.

The bundled `email-attachment-automation` skill teaches the agent this preferred
workflow:

- Use `email_download_matching_attachments` for "download today's attachments",
  "save attachments whose title contains ...", or similar automation requests.
- Use `email_search` first only when the user asks to inspect, preview, or
  confirm matching messages before download.
- Use `email_read` when the user identifies a specific message and wants body
  text or exact attachment details.
- Use `email_download_attachments` only after a specific `uid` or `messageId`
  is known.

This means a sufficiently capable agent can understand a request like
"download today's PDF attachments from emails with subject containing
performance test" and map it to the bulk download tool without needing the user
to name IMAP concepts.

## Tool Reference

| Tool                                  | Purpose                                                                   | Typical Inputs                                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `email_list`                          | List recent message headers from a mailbox.                               | `accountId`, `mailbox`, `limit`, `since`, `unseenOnly`                                                                           |
| `email_search`                        | Search messages and optionally include attachment inventory.              | `onDate`, `since`, `before`, `subjectContains`, `fromContains`, `toContains`, `attachmentFilenameContains`, `includeAttachments` |
| `email_read`                          | Read one message by UID or Message-ID.                                    | `uid` or `messageId`, `mailbox`, `markSeen`                                                                                      |
| `email_download_attachments`          | Download attachments from one known message.                              | `uid` or `messageId`, `outputDir`                                                                                                |
| `email_download_matching_attachments` | Search messages and download attachments in one automation-oriented call. | date filters, text filters, `attachmentFilenameContains`, `outputDir`                                                            |
| `email_send`                          | Send email with optional attachments.                                     | `to`, `cc`, `bcc`, `subject`, `text`, `html`, `attachments`                                                                      |

### Daily Attachment Automation

Use `email_download_matching_attachments` for recurring download jobs. It
supports:

- `onDate`: `"today"`, `"yesterday"`, or `YYYY-MM-DD`
- `since` / `before`: date range where `before` is exclusive
- `subjectContains`, `fromContains`, `toContains`
- `attachmentFilenameContains`
- `maxScanMessages` and `limit`
- `outputDir` under the configured allowed write root

Example tool arguments:

```json5
{
  onDate: "today",
  subjectContains: "performance test",
  attachmentFilenameContains: "pdf",
  outputDir: "./email-attachments/today",
}
```

The tool returns the matched message count, downloaded file paths, per-message
results, and failures. By default, files are grouped under `uid-<uid>`
subdirectories to avoid filename collisions across messages.

## Config Shape

Configure under `plugins.entries.email.config`.

High-level shape:

```json5
{
  plugins: {
    entries: {
      email: {
        enabled: true,
        config: {
          defaultAccountId: "main",
          accounts: [
            {
              id: "main",
              host: "imap.example.com",
              port: 993,
              secure: true,
              user: "agent@example.com",
              password: {
                source: "env",
                provider: "default",
                id: "EMAIL_IMAP_PASSWORD",
              },
              mailbox: "INBOX",
              smtp: {
                host: "smtp.example.com",
                port: 587,
                secure: false,
                startTls: true,
                user: "agent@example.com",
                password: {
                  source: "env",
                  provider: "default",
                  id: "EMAIL_SMTP_PASSWORD",
                },
                from: "agent@example.com",
                authMethod: "login",
              },
            },
          ],
          sendPolicy: {
            allowedReadRoots: ["./tmp/email-send"],
          },
          downloadPolicy: {
            allowedWriteRoots: ["./tmp/email-downloads"],
          },
        },
      },
    },
  },
}
```

### Account Fields

- `defaultAccountId`: account used when a tool call omits `accountId`.
- `accounts[].id`: stable account identifier used by tools.
- `accounts[].host`, `port`, `secure`: IMAP endpoint.
- `accounts[].user`, `password`: IMAP login. `password` may be a string or
  SecretRef.
- `accounts[].mailbox`: default mailbox, usually `INBOX`.
- `accounts[].smtp`: optional SMTP endpoint for `email_send`.
- `sendPolicy.allowedReadRoots`: roots from which SMTP attachments may be read.
- `downloadPolicy.allowedWriteRoots`: roots where downloaded attachments may be
  written.

Passwords should normally use SecretRef or environment-backed config rather
than plaintext.

## Filesystem Safety

The plugin applies separate read/write policies:

- Attachment downloads are restricted by `downloadPolicy.allowedWriteRoots`.
- SMTP attachments are restricted by `sendPolicy.allowedReadRoots`.
- Filenames are sanitized before writing to disk.
- Duplicate attachment filenames receive unique suffixes.

For automation, choose a stable output directory under an allowed root, for
example `./email-attachments/YYYY-MM-DD`.

## MIME And Charset Handling

The plugin includes a lightweight MIME parser for the supported workflows:

- RFC 2047 encoded-word decoding for common header and filename cases
- quoted-printable and base64 body/attachment decoding
- multipart traversal for body and attachment extraction
- non-UTF-8 charset decoding through `TextDecoder` when available

The current MIME layer is intentionally scoped. If future live-provider evidence
shows broader MIME compatibility is needed, add fixtures and validation before
expanding parser behavior.

## PDF Workflow

This plugin downloads PDF attachments as files. PDF analysis is handled by
OpenClaw's built-in `pdf` tool, not by the email plugin itself.

For a combined workflow, the agent should:

1. Call `email_download_matching_attachments` with date/title/filename filters.
2. Pass the returned `.pdf` file paths to the `pdf` tool with the user's
   analysis prompt.

Make sure the email download output directory is readable by the agent and is
compatible with any active filesystem policy.

## Design Intent

This plugin is on purpose a **thin transport + MIME layer** with OpenClaw-native
tools on top.

That means:

- tool APIs should stay stable and typed
- config should stay manifest-first
- transport details should stay plugin-local
- no direct core coupling should be introduced just because email grows

## Evolution Path

The recommended iteration order is:

### Phase 1: Live-SMTP/IMAP Hardening

Goal:

- prove the current transport stack against real providers before expanding the
  surface area

Suggested work:

- live smoke against one generic IMAP/SMTP provider
- better SMTP response diagnostics
- more MIME fixture coverage
- charset / quoted-printable / base64 edge-case fixes
- safer attachment content-type inference

Acceptance:

- one real mailbox can list mail, read mail, download an attachment, and send a
  message successfully
- no config / tool contract changes required

### Phase 2: Reply / Forward

Goal:

- add the next most natural user-facing operations without changing the
  underlying architecture

Suggested work:

- `email_reply`
- `email_forward`
- quoted-body generation
- reply header helpers (`In-Reply-To`, `References`)

Acceptance:

- reply/forward reuse the existing SMTP path
- message selection stays compatible with current `uid` / `messageId` model

### Phase 3: Drafts / Templates / Batch Send

Goal:

- improve operator workflows without introducing background state yet

Suggested work:

- template-aware send helper
- draft rendering helper
- batch recipient safety limits
- richer inline attachment support

Acceptance:

- still request/response oriented
- no background queue required

### Phase 4: OAuth2 / Provider-Specific Auth

Goal:

- support enterprise providers that cannot rely on basic auth forever

Suggested work:

- Outlook / Microsoft 365 OAuth2
- Gmail OAuth2 if needed later
- provider-specific auth config branches

Guardrail:

- do not bolt OAuth2 directly into the current generic account object if it
  makes the base config unreadable
- prefer additive nested auth config

Acceptance:

- basic-auth providers still work unchanged
- OAuth2 support does not degrade manifest-first config validation

### Phase 5: Background Services

Goal:

- move from single-call operations into durable email automation

Suggested work:

- outbound queue / retry
- watcher / poller / IDLE service
- dead-letter handling
- optional gateway methods for mailbox sync status

Guardrail:

- only introduce `registerService(...)` once live smoke proves the foreground
  transport is stable
- do not add background loops just to compensate for unproven foreground logic

Acceptance:

- service behavior is observable, restart-safe, and does not change the tool
  contract unexpectedly

## What To Avoid

- Do not add a heavy mail library unless live-provider evidence shows the native
  implementation is no longer worth maintaining.
- Do not mix unrelated workflow state into core OpenClaw modules.
- Do not add OAuth2, watchers, retries, and drafts all in one iteration.
- Do not relax `allowedReadRoots` / `allowedWriteRoots` just to make tests pass.

## Recommended Validation Per Iteration

Every iteration should keep these checks:

- `pnpm exec oxlint extensions/email --deny-warnings`
- targeted plugin tests under `extensions/email/src/*.test.ts`
- `pnpm openclaw plugins inspect email --json`

And when transport behavior changes materially:

- one live IMAP/SMTP smoke against a real provider

## Current Expansion Bias

If you are choosing the next step and there is no new product constraint,
prefer:

1. live-provider hardening
2. reply / forward
3. OAuth2
4. background services

This order keeps the plugin useful while preserving a clean native OpenClaw
architecture.
