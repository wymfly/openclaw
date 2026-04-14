import { getJsonStore } from "@server/json-store";

export interface DocEntry {
  id: string;
  title: string;
  category: string;
  content: string;
  sourceSession: string | null;
  sourceAgent: string | null;
  keywords: string[];
  language: string;
  extractedAt: string;
  updatedAt: string;
}

export function getDocStore() {
  return getJsonStore<DocEntry[]>("docs", []);
}
