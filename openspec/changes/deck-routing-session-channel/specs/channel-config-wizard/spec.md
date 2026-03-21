## ADDED Requirements

### Requirement: WeCom configuration wizard

The system SHALL provide a step-by-step wizard for configuring WeCom (企业微信) channel connections. The wizard SHALL have 4 steps: transport mode selection, enterprise information, callback URL configuration, and connection test.

#### Scenario: Select WeCom transport mode

- **WHEN** user starts the WeCom wizard (step 1)
- **THEN** four transport mode cards are presented: "Webhook 回调", "长连接 (WebSocket)", "客服消息 API", "自建应用"
- **THEN** each card shows a brief description and recommended use case

#### Scenario: Fill enterprise information

- **WHEN** user proceeds to step 2 after selecting transport mode
- **THEN** relevant fields are presented based on the selected mode (corpId, agentId, secret, token, encodingAESKey)
- **THEN** each field has inline help text explaining where to find the value in WeCom admin console

#### Scenario: Configure callback URL

- **WHEN** user proceeds to step 3
- **THEN** the system generates a callback URL based on the gateway's public address
- **THEN** a copy button and QR code are provided for easy configuration in WeCom admin

#### Scenario: Connection test succeeds

- **WHEN** user clicks "Test Connection" in step 4
- **THEN** the system verifies credentials via the existing channel API
- **THEN** a success message is displayed with the channel status showing "Connected"

#### Scenario: Connection test fails

- **WHEN** the connection test fails
- **THEN** the specific error is displayed (e.g., "Invalid corpId" or "Token mismatch")
- **THEN** the user can navigate back to the relevant step to fix the issue

### Requirement: Feishu configuration wizard

The system SHALL provide a step-by-step wizard for configuring Feishu (飞书) channel connections. The wizard SHALL have 3 steps: transport mode selection, application credentials, and connection test.

#### Scenario: Select Feishu transport mode

- **WHEN** user starts the Feishu wizard (step 1)
- **THEN** two transport mode cards are presented: "WebSocket (推荐)" and "Webhook 回调"
- **THEN** WebSocket card is marked as recommended with explanation "无需公网 IP"

#### Scenario: Fill application credentials

- **WHEN** user proceeds to step 2
- **THEN** fields for App ID and App Secret are presented
- **THEN** for Webhook mode, additional fields for Verification Token and Encrypt Key are shown

#### Scenario: Complete Feishu setup

- **WHEN** user completes all steps and passes the connection test
- **THEN** the channel appears in the Channels list with "Connected" status
- **THEN** the wizard closes and the new channel is auto-selected in the list

### Requirement: Multi-account management UI

The system SHALL allow managing multiple accounts per channel, including adding, removing, enabling, and disabling individual accounts.

#### Scenario: View all accounts for a channel

- **WHEN** user selects a channel with 3 configured accounts
- **THEN** all 3 accounts are listed with their status (enabled/disabled, connected/disconnected)

#### Scenario: Add a new account

- **WHEN** user clicks "Add Account" on a channel
- **THEN** the appropriate wizard (WeCom/Feishu/generic) is launched for the channel type

#### Scenario: Disable an account

- **WHEN** user toggles an account to "disabled"
- **THEN** the account stops receiving messages but its configuration is preserved
- **THEN** the account shows a "Disabled" badge

#### Scenario: Remove an account

- **WHEN** user clicks "Remove" on an account and confirms the dialog
- **THEN** the account is removed from the channel configuration
- **THEN** a success toast confirms the removal
