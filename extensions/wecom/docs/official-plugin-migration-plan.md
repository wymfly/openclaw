# Official WeCom Plugin Migration Plan

This note records the planned migration path from the enhanced in-tree WeCom plugin to Tencent's official `@wecom/wecom-openclaw-plugin`.

The current decision is **do not migrate yet**. Keep this file as the reference for a future controlled trial after the enhanced plugin has been validated against the current requirements.

## Decision Summary

Migrating is straightforward if all of these are true:

- Historical WeCom runtime/session data does not need to be migrated.
- Deck/Gateway UI-specific channel diagnostics can be temporarily ignored.
- The enhanced plugin's local-only tools and status model are not required.
- Existing WeCom platform credentials can be reused in a rewritten official-plugin config.

The migration is not a pure `openclaw.json` drop-in replacement. The two plugins use the same channel id (`wecom`) but different config schemas, so only one WeCom plugin must be loaded at a time.

## Current Enhanced Plugin Advantages

- Fits the current deployed Gateway/Deck diagnostics and channel status expectations.
- Preserves the existing enhanced `openclaw.json` schema.
- Supports the current multi-account and routing model used by the deployment.
- Contains local fixes for Agent callback replies, Markdown cleanup, outbound media, and MCP/smartsheet interception.
- Keeps local self-developed tools such as approval, external contact, direct REST helpers, and deployment-specific fallbacks.

## Official Plugin Advantages

- Maintained by Tencent WeCom team.
- Tracks official WeCom API behavior more directly.
- Has broader feature coverage, including richer message/card/media/MCP flows and more built-in skills.
- Has an official install path:

```bash
openclaw plugins install @wecom/wecom-openclaw-plugin
```

or the official helper:

```bash
npx -y @wecom/wecom-openclaw-cli install
```

## Config Mapping

Do not preserve the enhanced config shape unchanged. Rewrite `channels.wecom` to the official schema.

| Enhanced config                                                         | Official config                              |
| ----------------------------------------------------------------------- | -------------------------------------------- |
| `channels.wecom.bot.ws.botId`                                           | `channels.wecom.botId`                       |
| `channels.wecom.bot.ws.secret`                                          | `channels.wecom.secret`                      |
| `channels.wecom.bot.primaryTransport: "ws"`                             | `channels.wecom.connectionMode: "websocket"` |
| `channels.wecom.bot.webhook.token`                                      | `channels.wecom.token`                       |
| `channels.wecom.bot.webhook.encodingAESKey`                             | `channels.wecom.encodingAESKey`              |
| `channels.wecom.bot.webhook.receiveId`                                  | `channels.wecom.receiveId`                   |
| `channels.wecom.agent.corpId`                                           | `channels.wecom.agent.corpId`                |
| `channels.wecom.agent.agentSecret` or `channels.wecom.agent.corpSecret` | `channels.wecom.agent.corpSecret`            |
| `channels.wecom.agent.agentId`                                          | `channels.wecom.agent.agentId`               |
| `channels.wecom.agent.token`                                            | `channels.wecom.agent.token`                 |
| `channels.wecom.agent.encodingAESKey`                                   | `channels.wecom.agent.encodingAESKey`        |
| `channels.wecom.bot.dm.policy`                                          | `channels.wecom.dmPolicy`                    |
| `channels.wecom.bot.dm.allowFrom`                                       | `channels.wecom.allowFrom`                   |
| `channels.wecom.network.*`                                              | `channels.wecom.network.*`                   |
| `channels.wecom.media.*`                                                | `channels.wecom.media.*`                     |

## Trial Migration Procedure

1. Stop the current Gateway so the existing WeCom Bot/Agent connection is not active.
2. Back up at minimum:
   - `data\.openclaw\openclaw.json`
   - current WeCom plugin source/runtime directories
   - Gateway logs for the last known-good state
3. Ensure the enhanced WeCom plugin is not loaded.
   - Do not leave both plugins active, because both register channel id `wecom`.
4. Install the official plugin:

```bash
openclaw plugins install @wecom/wecom-openclaw-plugin
```

5. Rewrite `channels.wecom` using the official schema and the existing WeCom platform credentials.
6. Start Gateway.
7. Validate Bot WebSocket first because it usually avoids enterprise-console callback URL changes.
8. Validate Agent callback/proactive behavior second.

## Minimal Validation Matrix

- Gateway starts with exactly one WeCom channel provider.
- `/healthz` is healthy.
- Deck or Gateway channel listing reports WeCom running and authenticated.
- WeCom direct-message text round trip works.
- WeCom group text round trip works if group access is enabled.
- Agent callback URL receives and answers a message.
- Markdown reply renders acceptably.
- Local file/media send works for at least `txt`, `csv`, `pdf`, and `docx`.
- `wecom_mcp` can list and call document/smartsheet tools.
- Smartsheet record creation works with the official payload format.
- Existing email/PDF/WeCom workflow still gives the bound agent the required tool access.

## Rollback

Rollback should restore:

- the previous `openclaw.json`
- the enhanced WeCom plugin source/runtime
- the previous Gateway service command/task

After rollback, verify:

- Gateway health is `200`.
- WeCom channel reports connected/authenticated.
- A real WeCom message receives a response.

## Open Risks

- The official plugin is not a drop-in config replacement.
- The current source-run deployment may include bundled `extensions/wecom`; replacing it requires controlling plugin load order, not only editing config.
- The official plugin expects `agent.corpSecret`; existing enhanced configs may use `agent.agentSecret`.
- Agent callback paths must match the enterprise WeCom console settings.
- Deck UI/status may not understand the official plugin's full runtime state without additional adapter work.
- Local-only enhanced tools may disappear unless ported or replaced.
