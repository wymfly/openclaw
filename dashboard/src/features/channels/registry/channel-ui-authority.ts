import { getAccessDescriptor } from "@/components/panels/channels/access-descriptors/access-descriptor-registry";
import { getLocalOnboardingDescriptor } from "./channel-onboarding-descriptors";
import {
  createGenericChannelUiEntry,
  createSchemaOnlyChannelUiEntry,
  getChannelUiRegistryEntry,
} from "./channel-ui-registry";
import type {
  ChannelUiActionDefinition,
  ChannelUiActionKey,
  ResolvedChannelUiDefinition,
  ResolveChannelUiDefinitionInput,
} from "./channel-ui-types";
import { createManifestMetadataFallback } from "./manifest-metadata-fallback";

const ACTION_KEYS: ChannelUiActionKey[] = ["login", "probe", "testMessage"];

type ChannelUiAuthorityBase = Omit<ResolvedChannelUiDefinition, "actions" | "onboarding">;

function resolveAction(
  key: ChannelUiActionKey,
  base: ChannelUiAuthorityBase,
): ChannelUiActionDefinition | null {
  const behavior = base.actionBehaviors[key];
  const fallbackEnabled = base.fallback.actionCapabilities[key];

  if (key === "login" && base.ownership.onboarding === "descriptor" && base.onboardingDescriptor) {
    return {
      key,
      enabled: true,
      behavior: behavior ?? "custom",
      source: "local",
    };
  }

  if (
    base.ownership.onboarding === "wizard-spec" &&
    key === "login" &&
    base.fallback.hasWizardSpec
  ) {
    return {
      key,
      enabled: true,
      behavior: behavior ?? "generic",
      source: "fallback",
    };
  }

  if (typeof fallbackEnabled === "boolean") {
    return {
      key,
      enabled: fallbackEnabled,
      behavior: behavior ?? "generic",
      source: "fallback",
    };
  }

  if (behavior) {
    return {
      key,
      enabled: false,
      behavior,
      source: "local",
    };
  }

  return null;
}

export function resolveChannelUiDefinition(
  input: ResolveChannelUiDefinitionInput,
): ResolvedChannelUiDefinition {
  const accessDescriptor = input.accessDescriptor ?? getAccessDescriptor(input.channelId);
  const onboardingDescriptor =
    input.onboardingDescriptor ?? getLocalOnboardingDescriptor(input.channelId);
  const registryEntry =
    getChannelUiRegistryEntry(input.channelId) ??
    (input.channelSchema ? createSchemaOnlyChannelUiEntry(input.channelId) : null) ??
    createGenericChannelUiEntry(input.channelId);
  const fallback = createManifestMetadataFallback(input.plugin);

  const base: ChannelUiAuthorityBase = {
    ...registryEntry,
    fallback,
    accessDescriptor,
    onboardingDescriptor,
    accessDescriptorPresent: Boolean(accessDescriptor),
    onboardingDescriptorPresent: Boolean(onboardingDescriptor),
    channelPresent: Boolean(input.channel),
    channelSchemaPresent: Boolean(input.channelSchema),
  };

  const actions = ACTION_KEYS.map((key) => resolveAction(key, base)).filter(
    (action): action is ChannelUiActionDefinition => Boolean(action),
  );

  return {
    ...base,
    actions,
    onboarding: {
      kind: base.ownership.onboarding,
      source:
        base.ownership.onboarding === "descriptor" && onboardingDescriptor
          ? "local"
          : base.ownership.onboarding === "wizard-spec" && fallback.hasWizardSpec
            ? "fallback"
            : "none",
      hasDescriptor: Boolean(onboardingDescriptor),
      hasWizardSpec: fallback.hasWizardSpec,
    },
    fallback,
  };
}

export function getLegacyTabForPage(
  definition: ResolvedChannelUiDefinition,
  pageKey: ResolvedChannelUiDefinition["pages"][number]["key"],
) {
  return definition.pageAliases.find((alias) => alias.to === pageKey)?.from ?? null;
}

export function getHostTabForPage(
  definition: ResolvedChannelUiDefinition,
  pageKey: ResolvedChannelUiDefinition["pages"][number]["key"],
) {
  return (
    definition.pages.find((page) => page.key === pageKey)?.hostTab ??
    getLegacyTabForPage(definition, pageKey)
  );
}

export function getEntryVisiblePages(definition: ResolvedChannelUiDefinition) {
  return definition.pages.filter((page) => page.enabled && page.entryVisible);
}

export function usesSecondaryPageShell(definition: ResolvedChannelUiDefinition) {
  return definition.shellVariant === "secondary-page-shell";
}

export function isLegacyTabEnabled(
  definition: ResolvedChannelUiDefinition,
  legacyTab: ResolvedChannelUiDefinition["pageAliases"][number]["from"],
) {
  const alias = definition.pageAliases.find((candidate) => candidate.from === legacyTab);
  if (!alias) {
    return false;
  }
  return definition.pages.some((page) => page.key === alias.to && page.enabled);
}
