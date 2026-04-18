import type { AccessDescriptor } from "@/components/panels/channels/access-descriptors/access-descriptor.types";
import type { ChannelInfo, ChannelSchemaInfo } from "@/stores/channels";
import type {
  InventoryPluginEntry,
  InventoryPluginLocaleBundle,
  InventoryWizardSpec,
} from "@/stores/plugins";
import type { ChannelOnboardingDescriptor } from "./channel-onboarding-descriptors";

export type ChannelUiMode = "generic" | "hybrid" | "bespoke";

export type ChannelUiPageKey =
  | "overview"
  | "onboarding"
  | "access"
  | "settings"
  | "diagnostics"
  | "capabilities"
  | "bindings"
  | "analytics";

export type ChannelUiLegacyPageKey = "status" | "access" | "bindings" | "settings" | "analytics";

export type ChannelUiActionKey = "login" | "probe" | "testMessage";

export type ChannelUiBehavior = "generic" | "custom";
export type ChannelUiShellVariant = "none" | "secondary-page-shell";

export type ChannelUiOnboardingKind = "none" | "descriptor" | "wizard-spec";

export type ChannelUiSettingsMode = "generic" | "hybrid" | "custom";

export type ChannelUiAccessMode = "none" | "descriptor" | "custom";

export interface ChannelUiPageDefinition {
  key: ChannelUiPageKey;
  enabled: boolean;
  entryVisible: boolean;
  hostTab: ChannelUiLegacyPageKey;
  behavior: ChannelUiBehavior;
}

export interface ChannelUiPageAlias {
  from: ChannelUiLegacyPageKey;
  to: ChannelUiPageKey;
}

export interface ChannelUiActionDefinition {
  key: ChannelUiActionKey;
  enabled: boolean;
  behavior: ChannelUiBehavior;
  source: "local" | "fallback";
}

export interface ChannelUiOwnership {
  onboarding: ChannelUiOnboardingKind;
  settings: ChannelUiSettingsMode;
  access: ChannelUiAccessMode;
}

export interface ChannelUiRegistryEntry {
  channelId: string;
  pluginId?: string;
  mode: ChannelUiMode;
  shellVariant?: ChannelUiShellVariant;
  pages: ChannelUiPageDefinition[];
  pageAliases: ChannelUiPageAlias[];
  ownership: ChannelUiOwnership;
  actionBehaviors: Partial<Record<ChannelUiActionKey, ChannelUiBehavior>>;
}

export interface ManifestMetadataFallback {
  actionCapabilities: Partial<Record<ChannelUiActionKey, boolean>>;
  wizardSpec?: InventoryWizardSpec;
  locales?: InventoryPluginLocaleBundle;
  hasWizardSpec: boolean;
  hasLocales: boolean;
  sources: Array<"deckActionCapabilities" | "setupWizardSpec" | "locales">;
}

export interface ChannelUiOnboardingResolution {
  kind: ChannelUiOnboardingKind;
  source: "none" | "local" | "fallback";
  hasDescriptor: boolean;
  hasWizardSpec: boolean;
}

export interface ResolveChannelUiDefinitionInput {
  channelId: string;
  channel?: ChannelInfo | null;
  channelSchema?: ChannelSchemaInfo | null;
  plugin?: InventoryPluginEntry | null;
  accessDescriptor?: AccessDescriptor | null;
  onboardingDescriptor?: ChannelOnboardingDescriptor | null;
}

export interface ResolvedChannelUiDefinition extends ChannelUiRegistryEntry {
  actions: ChannelUiActionDefinition[];
  onboarding: ChannelUiOnboardingResolution;
  fallback: ManifestMetadataFallback;
  accessDescriptor: AccessDescriptor | null;
  onboardingDescriptor: ChannelOnboardingDescriptor | null;
  accessDescriptorPresent: boolean;
  onboardingDescriptorPresent: boolean;
  channelPresent: boolean;
  channelSchemaPresent: boolean;
}
