export type DataFabricGovernanceException = {
  filePath: string;
  followUpStatus: "approved" | "deferred";
  owner: string;
  pattern: string;
  reason: string;
};

export const dataFabricGovernanceExceptions: readonly DataFabricGovernanceException[] = [
  {
    filePath: "src/components/panels/chat/chat-api.ts",
    followUpStatus: "approved",
    owner: "chat",
    pattern: "raw-api-fetch-import",
    reason:
      "Chat adapter/normalizer facade wraps BFF DTOs for migrated Chat components; component lifecycles should use Data Fabric modules instead of copying this pattern.",
  },
  {
    filePath: "src/components/panels/chat/chat-api.ts",
    followUpStatus: "approved",
    owner: "chat",
    pattern: "raw-fetch-helper-call",
    reason:
      "Chat adapter helpers call BFF facade functions internally as an approved normalizer seam; ordinary panel code must use Data Fabric modules instead.",
  },
  {
    filePath: "src/components/panels/chat/useChatSSE.ts",
    followUpStatus: "approved",
    owner: "chat",
    pattern: "chat-adapter-fetch-import",
    reason:
      "Transcript stream dispatcher performs bounded authoritative refresh around SSE lifecycle and should remain separate from ordinary panel first-load reads.",
  },
  {
    filePath: "src/components/panels/chat/useChatSSE.ts",
    followUpStatus: "approved",
    owner: "chat",
    pattern: "raw-fetch-helper-call",
    reason:
      "Transcript stream dispatcher performs bounded authoritative snapshot and list refreshes around SSE lifecycle; ordinary panel reads must not copy it.",
  },
  {
    filePath: "src/components/panels/chat/slash-command-executor.ts",
    followUpStatus: "approved",
    owner: "chat",
    pattern: "raw-api-fetch-import",
    reason:
      "Slash command execution resolves command-specific runtime state on demand; it is not a panel background refresh lifecycle.",
  },
  {
    filePath: "src/components/panels/chat/slash-command-executor.ts",
    followUpStatus: "approved",
    owner: "chat",
    pattern: "raw-fetch-helper-call",
    reason:
      "Slash command execution calls command-specific fetch helpers on demand; it is not a panel first-load or background refresh lifecycle.",
  },
  {
    filePath: "src/stores/chat-dispatchers.ts",
    followUpStatus: "approved",
    owner: "chat",
    pattern: "raw-api-fetch-import",
    reason:
      "reloadFullContent is the imperative transcript history recovery seam after stream finalization.",
  },
  {
    filePath: "src/stores/chat-dispatchers.ts",
    followUpStatus: "approved",
    owner: "chat",
    pattern: "raw-fetch-helper-call",
    reason:
      "reloadFullContent may call the Chat history facade as the imperative transcript recovery seam after stream finalization.",
  },
  {
    filePath: "src/stores/approvals.ts",
    followUpStatus: "approved",
    owner: "approvals",
    pattern: "stream-ui-bridge-mutation",
    reason:
      "Approvals store is limited to pending-approval stream/UI bridge state and inline approval resolution; store-owned fetch lifecycles are not allowed.",
  },
];
