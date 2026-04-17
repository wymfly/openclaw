import type { DeckPluginsListResult } from "@/types/gateway-protocol.generated";

export type WizardInventoryEntry = DeckPluginsListResult["plugins"][number];
export type WizardI18nString = string;
export type WizardParamRef = { $ref: string };
export type WizardParamValue = string | number | boolean | WizardParamRef;

export type WizardAction = {
  action: string;
  params?: Record<string, WizardParamValue>;
};

export type WizardInfoStep = {
  id: string;
  type: "info";
  title: WizardI18nString;
  body: WizardI18nString;
};

export type WizardRadioOption = {
  value: string;
  label: WizardI18nString;
  description?: WizardI18nString;
  badge?: WizardI18nString;
};

export type WizardRadioStep = {
  id: string;
  type: "radio";
  title: WizardI18nString;
  options: WizardRadioOption[];
};

export type WizardFormFieldSchema = {
  type?: string;
  title?: WizardI18nString;
  description?: WizardI18nString;
  placeholder?: WizardI18nString;
  format?: string;
  [key: string]: unknown;
};

export type WizardFormSchema = {
  type?: string;
  required?: string[];
  properties?: Record<string, WizardFormFieldSchema>;
  [key: string]: unknown;
};

export type WizardFormStep = {
  id: string;
  type: "form";
  title: WizardI18nString;
  schema: WizardFormSchema;
};

export type WizardActionStep = {
  id: string;
  type: "action";
  title: WizardI18nString;
  description?: WizardI18nString;
  action: string;
  params?: Record<string, WizardParamValue>;
  successMessage?: WizardI18nString;
  failureMessage?: WizardI18nString;
};

export type WizardStep = WizardInfoStep | WizardRadioStep | WizardFormStep | WizardActionStep;

export type WizardSpec = {
  steps: WizardStep[];
  onComplete: WizardAction;
};
