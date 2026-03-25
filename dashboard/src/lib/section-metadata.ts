/**
 * Static metadata for known config sections.
 * Used by SectionIntroCard to display contextual intro with icon, description, and docs link.
 * Unknown sections gracefully degrade (no intro card shown).
 */
export interface SectionMeta {
  /** i18n key relative to the "config" namespace, e.g. "sectionIntro.agents.title" */
  titleKey: string;
  /** i18n key relative to the "config" namespace, e.g. "sectionIntro.agents.description" */
  descriptionKey: string;
  /** Full docs URL */
  docsUrl: string;
  /** Lucide icon component name (must exist in SectionIntroCard ICON_MAP) */
  icon: string;
}

export const SECTION_META: Record<string, SectionMeta> = {
  agents: {
    titleKey: "sectionIntro.agents.title",
    descriptionKey: "sectionIntro.agents.description",
    docsUrl: "https://docs.openclaw.ai/configuration#agents",
    icon: "Bot",
  },
  tools: {
    titleKey: "sectionIntro.tools.title",
    descriptionKey: "sectionIntro.tools.description",
    docsUrl: "https://docs.openclaw.ai/configuration#tools",
    icon: "Wrench",
  },
  gateway: {
    titleKey: "sectionIntro.gateway.title",
    descriptionKey: "sectionIntro.gateway.description",
    docsUrl: "https://docs.openclaw.ai/gateway",
    icon: "Server",
  },
  channels: {
    titleKey: "sectionIntro.channels.title",
    descriptionKey: "sectionIntro.channels.description",
    docsUrl: "https://docs.openclaw.ai/configuration#channels",
    icon: "Share2",
  },
  models: {
    titleKey: "sectionIntro.models.title",
    descriptionKey: "sectionIntro.models.description",
    docsUrl: "https://docs.openclaw.ai/configuration#models",
    icon: "Brain",
  },
  hooks: {
    titleKey: "sectionIntro.hooks.title",
    descriptionKey: "sectionIntro.hooks.description",
    docsUrl: "https://docs.openclaw.ai/configuration#hooks",
    icon: "Webhook",
  },
  secrets: {
    titleKey: "sectionIntro.secrets.title",
    descriptionKey: "sectionIntro.secrets.description",
    docsUrl: "https://docs.openclaw.ai/configuration#secrets",
    icon: "Lock",
  },
  logging: {
    titleKey: "sectionIntro.logging.title",
    descriptionKey: "sectionIntro.logging.description",
    docsUrl: "https://docs.openclaw.ai/configuration#logging",
    icon: "FileText",
  },
  update: {
    titleKey: "sectionIntro.update.title",
    descriptionKey: "sectionIntro.update.description",
    docsUrl: "https://docs.openclaw.ai/configuration#update",
    icon: "RefreshCw",
  },
  browser: {
    titleKey: "sectionIntro.browser.title",
    descriptionKey: "sectionIntro.browser.description",
    docsUrl: "https://docs.openclaw.ai/configuration#browser",
    icon: "Globe",
  },
};
