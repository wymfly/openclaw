/**
 * Token pricing lookup and cost calculation.
 *
 * Transplanted from vendor/mission-control with MC-specific provider-subscription
 * logic removed. Signature simplified to (modelName, inputTokens, outputTokens).
 */

interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
}

const DEFAULT_MODEL_PRICING: ModelPricing = {
  inputPerMTok: 3.0,
  outputPerMTok: 15.0,
};

const MODEL_PRICING: Record<string, ModelPricing> = {
  "anthropic/claude-3-5-haiku-latest": { inputPerMTok: 0.8, outputPerMTok: 4.0 },
  "claude-3-5-haiku": { inputPerMTok: 0.8, outputPerMTok: 4.0 },
  "anthropic/claude-haiku-4-5": { inputPerMTok: 0.8, outputPerMTok: 4.0 },
  "claude-haiku-4-5": { inputPerMTok: 0.8, outputPerMTok: 4.0 },

  "anthropic/claude-sonnet-4-20250514": { inputPerMTok: 3.0, outputPerMTok: 15.0 },
  "claude-sonnet-4": { inputPerMTok: 3.0, outputPerMTok: 15.0 },
  "anthropic/claude-sonnet-4-5": { inputPerMTok: 3.0, outputPerMTok: 15.0 },
  "claude-sonnet-4-5": { inputPerMTok: 3.0, outputPerMTok: 15.0 },
  "anthropic/claude-sonnet-4-6": { inputPerMTok: 3.0, outputPerMTok: 15.0 },
  "claude-sonnet-4-6": { inputPerMTok: 3.0, outputPerMTok: 15.0 },

  "anthropic/claude-opus-4-5": { inputPerMTok: 15.0, outputPerMTok: 75.0 },
  "claude-opus-4-5": { inputPerMTok: 15.0, outputPerMTok: 75.0 },
  "anthropic/claude-opus-4-6": { inputPerMTok: 15.0, outputPerMTok: 75.0 },
  "claude-opus-4-6": { inputPerMTok: 15.0, outputPerMTok: 75.0 },

  // DeepSeek
  "deepseek/deepseek-chat-v3": { inputPerMTok: 0.27, outputPerMTok: 1.1 },

  // Non-Anthropic models
  "groq/llama-3.1-8b-instant": { inputPerMTok: 0.05, outputPerMTok: 0.05 },
  "groq/llama-3.3-70b-versatile": { inputPerMTok: 0.59, outputPerMTok: 0.59 },
  "moonshot/kimi-k2.5": { inputPerMTok: 1.0, outputPerMTok: 1.0 },
  "venice/llama-3.3-70b": { inputPerMTok: 0.7, outputPerMTok: 2.8 },
  "minimax/minimax-m2.1": { inputPerMTok: 0.3, outputPerMTok: 0.3 },

  // Free / local models
  "ollama/deepseek-r1:14b": { inputPerMTok: 0.0, outputPerMTok: 0.0 },
  "ollama/qwen2.5-coder:7b": { inputPerMTok: 0.0, outputPerMTok: 0.0 },
  "ollama/qwen2.5-coder:14b": { inputPerMTok: 0.0, outputPerMTok: 0.0 },
};

export function normalizedModelName(modelName: string): string {
  return modelName.trim().toLowerCase();
}

/**
 * Look up pricing for a model. Tries exact match first, then fuzzy match
 * on the short name (portion after the last `/`). Falls back to default.
 */
export function getModelPricing(modelName: string): ModelPricing {
  const normalized = normalizedModelName(modelName);
  if (MODEL_PRICING[normalized] !== undefined) {
    return MODEL_PRICING[normalized];
  }

  for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
    const shortName = model.split("/").pop() || model;
    if (normalized.includes(shortName)) {
      return pricing;
    }
  }

  return DEFAULT_MODEL_PRICING;
}

/**
 * Calculate the cost in USD for a given model and token counts.
 */
export function calculateTokenCost(
  modelName: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = getModelPricing(modelName);
  return (inputTokens * pricing.inputPerMTok + outputTokens * pricing.outputPerMTok) / 1_000_000;
}
