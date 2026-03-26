export interface ProviderDefaults {
  displayName: string;
  defaultBaseUrl: string;
  authType: "api-key" | "oauth" | "aws-sdk" | "token";
  api: string;
}

export const KNOWN_PROVIDER_DEFAULTS: Record<string, ProviderDefaults> = {
  anthropic: {
    displayName: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
    authType: "api-key",
    api: "anthropic-messages",
  },
  openai: {
    displayName: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    authType: "api-key",
    api: "openai-responses",
  },
  deepseek: {
    displayName: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com",
    authType: "api-key",
    api: "openai-completions",
  },
  google: {
    displayName: "Google",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    authType: "api-key",
    api: "google-generative-ai",
  },
  moonshot: {
    displayName: "Moonshot",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    authType: "api-key",
    api: "openai-completions",
  },
  mistral: {
    displayName: "Mistral",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    authType: "api-key",
    api: "openai-completions",
  },
  groq: {
    displayName: "Groq",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    authType: "api-key",
    api: "openai-completions",
  },
};
