import type { DeckPluginsListResult } from "@/types/gateway-protocol.generated";

export type WizardInventoryEntry = DeckPluginsListResult["plugins"][number];
export type WizardSpec = NonNullable<WizardInventoryEntry["setupWizardSpec"]>;
export type WizardStep = WizardSpec["steps"][number];
