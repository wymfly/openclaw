import type { PairingRequest, NodeSummary } from "@/stores/nodes";

export type NodeLifecycleTone = "success" | "warning" | "neutral";

export interface NodeLifecycleSummary {
  tone: NodeLifecycleTone;
  titleKey:
    | "lifecycleRepairTitle"
    | "lifecyclePendingTitle"
    | "lifecycleConnectedTitle"
    | "lifecycleOfflineTitle"
    | "lifecycleUnpairedTitle";
  descriptionKey:
    | "lifecycleRepairDescription"
    | "lifecyclePendingDescription"
    | "lifecycleConnectedDescription"
    | "lifecycleOfflineDescription"
    | "lifecycleUnpairedDescription";
  nextStepKey:
    | "lifecycleRepairNextStep"
    | "lifecyclePendingNextStep"
    | "lifecycleConnectedNextStep"
    | "lifecycleOfflineNextStep"
    | "lifecycleUnpairedNextStep";
}

export function getNodeLifecycleSummary(
  node: NodeSummary,
  pendingRequest: PairingRequest | null,
): NodeLifecycleSummary {
  if (pendingRequest?.isRepair) {
    return {
      tone: "warning",
      titleKey: "lifecycleRepairTitle",
      descriptionKey: "lifecycleRepairDescription",
      nextStepKey: "lifecycleRepairNextStep",
    };
  }

  if (pendingRequest) {
    return {
      tone: "warning",
      titleKey: "lifecyclePendingTitle",
      descriptionKey: "lifecyclePendingDescription",
      nextStepKey: "lifecyclePendingNextStep",
    };
  }

  if (node.connected && node.paired) {
    return {
      tone: "success",
      titleKey: "lifecycleConnectedTitle",
      descriptionKey: "lifecycleConnectedDescription",
      nextStepKey: "lifecycleConnectedNextStep",
    };
  }

  if (node.paired) {
    return {
      tone: "warning",
      titleKey: "lifecycleOfflineTitle",
      descriptionKey: "lifecycleOfflineDescription",
      nextStepKey: "lifecycleOfflineNextStep",
    };
  }

  return {
    tone: "neutral",
    titleKey: "lifecycleUnpairedTitle",
    descriptionKey: "lifecycleUnpairedDescription",
    nextStepKey: "lifecycleUnpairedNextStep",
  };
}
