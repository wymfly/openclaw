export type ModelInputType = "text" | "image" | "document";

export type ModelCatalogCost = {
  input: number; // $/1M tokens
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

export type ModelCatalogEntry = {
  id: string;
  name: string;
  provider: string;
  alias?: string;
  contextWindow?: number;
  reasoning?: boolean;
  input?: ModelInputType[];
  cost?: ModelCatalogCost;
  maxTokens?: number;
};
