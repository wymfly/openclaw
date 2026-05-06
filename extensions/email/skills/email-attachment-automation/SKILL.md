---
name: email-attachment-automation
description: Download email attachments from a configured OpenClaw email account by date, subject, sender, recipient, or attachment filename.
---

Use this skill when the user asks to retrieve, search, save, archive, or download
email attachments from a configured mailbox.

Default workflow:

- Prefer `email_download_matching_attachments` when the request is to download
  attachments. It performs the mailbox search and attachment download in one
  tool call.
- Use `email_search` first only when the user asks to preview candidate emails,
  confirm matches, or inspect titles before downloading.
- Use `email_read` when the user names a specific message and wants its body or
  exact attachment inventory.
- Use `email_download_attachments` only after a specific `uid` or `messageId`
  is already known.

Daily automation guidance:

- For "today", "daily", or "this day's emails", pass `onDate: "today"`.
- If the user gives a date, pass that date as `onDate` in `YYYY-MM-DD` form.
- If the user gives a date range, pass `since` and `before`; `before` is an
  exclusive upper bound.
- If the user gives title text, pass `subjectContains`.
- If the user gives attachment-name text, pass `attachmentFilenameContains`.
- If the user gives sender or recipient text, pass `fromContains` or
  `toContains`.
- Choose an `outputDir` under the configured allowed write root. If the user did
  not specify one, use a stable workspace-relative directory such as
  `./email-attachments/today` or `./email-attachments/YYYY-MM-DD`.

Operational guardrails:

- Do not ask for mailbox credentials when the plugin already has a configured
  account. Use the default account unless the user names a specific `accountId`.
- Do not invent mailbox names. Use the configured mailbox or `INBOX` unless the
  user explicitly names another mailbox.
- For recurring jobs, keep filters explicit and deterministic: date window,
  optional subject text, optional attachment filename text, and fixed output
  directory.
- If `truncatedScan` is true in `email_search`, narrow the date window or raise
  `maxScanMessages` before assuming there are no matches.
