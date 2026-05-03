# Webhooks States

## Loading

- Inventory column shows `Webhooks loading` with stable metric shells.
- Detail column shows a neutral selected-state placeholder.
- No spinner should resize the workbench.

## Ready

- Inventory shows configured webhooks, enabled count, failure count, and selected delivery count.
- Selected detail shows receiver URL, event subscriptions, failure/last status evidence, delivery rows, and raw payload details.
- The first viewport should expose the key receiver and delivery evidence without nested decorative cards.

## Empty

- Inventory shows zero configured receivers and a create action.
- Detail column shows `Choose a webhook to inspect it.`
- Delivery and raw payload regions should not render blank framed panes.

## Error

- Read or action errors render as inline evidence near the relevant workbench region.
- Existing data remains visible if possible.
- Errors must use wrapped text so long receiver errors do not overflow.

## Form

- New mode starts from `DEFAULT_WEBHOOK_DRAFT`.
- Edit mode loads selected webhook values through `draftFromWebhook`.
- Event toggle buttons update the comma-separated events field without losing manually typed events.
- Save uses the current `webhookInputFromDraft` payload shape.

## Delivery History

- Delivery rows show success/failure, status, duration, attempt, retry, created time, and optional detail.
- Missing optional fields render as `n/a` or an omitted secondary row rather than fabricated values.

## Test Delivery

- Test action disables only the test control while in flight.
- Last action raw detail shows the test result.
- Refresh reloads inventory and delivery history for the selected webhook.

## Delete Confirmation

- Delete remains guarded by `window.confirm`.
- Cancel leaves selected webhook, delivery history, and action result unchanged.
- Success refreshes inventory and selects the fallback webhook if available.
