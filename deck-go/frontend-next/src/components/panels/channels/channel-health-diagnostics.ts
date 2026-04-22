import type { ChannelAccount } from "@/stores/channels";

export type ChannelDiagnosticTone = "success" | "warning" | "error" | "neutral";

export interface AccountHealthDiagnostic {
  tone: ChannelDiagnosticTone;
  titleKey:
    | "healthyTitle"
    | "configIncompleteTitle"
    | "enabledNotLinkedTitle"
    | "linkedDisconnectedTitle"
    | "accountErrorTitle"
    | "disabledTitle";
  descriptionKey:
    | "healthyDescription"
    | "configIncompleteDescription"
    | "enabledNotLinkedDescription"
    | "linkedDisconnectedDescription"
    | "accountErrorDescription"
    | "disabledDescription";
  nextStepKey:
    | "healthyNextStep"
    | "configIncompleteNextStep"
    | "enabledNotLinkedNextStep"
    | "linkedDisconnectedNextStep"
    | "accountErrorNextStep"
    | "disabledNextStep";
}

export function getAccountHealthDiagnostic(account: ChannelAccount): AccountHealthDiagnostic {
  if (account.enabled === false) {
    return {
      tone: "neutral",
      titleKey: "disabledTitle",
      descriptionKey: "disabledDescription",
      nextStepKey: "disabledNextStep",
    };
  }

  if (account.configured === false) {
    return {
      tone: "warning",
      titleKey: "configIncompleteTitle",
      descriptionKey: "configIncompleteDescription",
      nextStepKey: "configIncompleteNextStep",
    };
  }

  if (account.lastError) {
    return {
      tone: "error",
      titleKey: "accountErrorTitle",
      descriptionKey: "accountErrorDescription",
      nextStepKey: "accountErrorNextStep",
    };
  }

  if (account.linked && !account.connected) {
    return {
      tone: "warning",
      titleKey: "linkedDisconnectedTitle",
      descriptionKey: "linkedDisconnectedDescription",
      nextStepKey: "linkedDisconnectedNextStep",
    };
  }

  if (account.enabled && !account.linked) {
    return {
      tone: "warning",
      titleKey: "enabledNotLinkedTitle",
      descriptionKey: "enabledNotLinkedDescription",
      nextStepKey: "enabledNotLinkedNextStep",
    };
  }

  return {
    tone: "success",
    titleKey: "healthyTitle",
    descriptionKey: "healthyDescription",
    nextStepKey: "healthyNextStep",
  };
}
