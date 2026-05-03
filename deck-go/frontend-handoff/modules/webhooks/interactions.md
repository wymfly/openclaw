# Webhooks Interactions

## Select Webhook

1. Operator chooses a webhook row.
2. UI sets `selectedWebhookId`.
3. UI loads deliveries for that webhook.
4. Detail column shows selected receiver and delivery history.

## Refresh

1. Operator clicks refresh.
2. UI calls `fetchWebhooks`.
3. UI preserves selected webhook if it still exists.
4. UI reloads delivery history for the selected webhook.

## Create Webhook

1. Operator clicks New Webhook.
2. UI switches to form mode with default draft.
3. Operator fills name, URL, optional secret, events, and enabled state.
4. UI calls `createWebhook(webhookInputFromDraft(draft))`.
5. UI refreshes inventory, selects the created webhook, and shows last action raw detail.

## Edit Webhook

1. Operator clicks Edit Webhook for the selected receiver.
2. UI loads selected webhook into draft.
3. Operator changes fields or event toggles.
4. UI calls `updateWebhook(selectedId, webhookInputFromDraft(draft))`.
5. UI refreshes inventory and keeps selected identity.

## Toggle Events

1. Operator clicks an event chip.
2. UI adds or removes that event from the comma-separated events field.
3. Manually typed event names remain unless explicitly removed.

## Test Delivery

1. Operator clicks Test Delivery.
2. UI calls `testWebhook(selectedId)`.
3. UI shows last action raw evidence.
4. UI refreshes selected delivery history.

## Delete Webhook

1. Operator clicks Delete Webhook.
2. UI asks for confirmation using the selected webhook id.
3. Cancel stops without API calls.
4. Confirm calls `deleteWebhook(selectedId)`, refreshes inventory, and shows raw delete evidence.
