# Email (plugin)

Bundled native email plugin for **OpenClaw**.

Current scope:

- IMAP message listing
- IMAP message read / preview
- IMAP attachment download
- SMTP send
- SMTP send with attachments

The plugin is intentionally built with **no new third-party mail dependency**.
That keeps the first iterations easy to ship and reason about, but it also
means future iterations should expand carefully, with explicit validation at
each step.

## Current Tools

- `email_list`
- `email_read`
- `email_download_attachments`
- `email_send`

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
                id: "EMAIL_IMAP_PASSWORD"
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
                  id: "EMAIL_SMTP_PASSWORD"
                },
                from: "agent@example.com",
                authMethod: "login"
              }
            }
          ],
          sendPolicy: {
            allowedReadRoots: ["./tmp/email-send"]
          },
          downloadPolicy: {
            allowedWriteRoots: ["./tmp/email-downloads"]
          }
        }
      }
    }
  }
}
```

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
