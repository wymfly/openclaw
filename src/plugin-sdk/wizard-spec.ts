import { Static, Type } from "@sinclair/typebox";

export const WizardI18nStringSchema = Type.String();

export const WizardParamRefSchema = Type.Object(
  {
    $ref: Type.String(),
  },
  { additionalProperties: false },
);

export const WizardParamValueSchema = Type.Union([
  Type.String(),
  Type.Number(),
  Type.Boolean(),
  WizardParamRefSchema,
]);

export const WizardActionSchema = Type.Object(
  {
    action: Type.String(),
    params: Type.Optional(Type.Record(Type.String(), WizardParamValueSchema)),
  },
  { additionalProperties: false },
);

export const WizardInfoStepSchema = Type.Object(
  {
    id: Type.String(),
    type: Type.Literal("info"),
    title: WizardI18nStringSchema,
    body: WizardI18nStringSchema,
  },
  { additionalProperties: false },
);

export const WizardRadioOptionSchema = Type.Object(
  {
    value: Type.String(),
    label: WizardI18nStringSchema,
    description: Type.Optional(WizardI18nStringSchema),
    badge: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const WizardRadioStepSchema = Type.Object(
  {
    id: Type.String(),
    type: Type.Literal("radio"),
    title: WizardI18nStringSchema,
    options: Type.Array(WizardRadioOptionSchema, { minItems: 1 }),
  },
  { additionalProperties: false },
);

export const WizardFormStepSchema = Type.Object(
  {
    id: Type.String(),
    type: Type.Literal("form"),
    title: WizardI18nStringSchema,
    schema: Type.Object({}, { additionalProperties: true }),
  },
  { additionalProperties: false },
);

export const WizardActionStepSchema = Type.Object(
  {
    id: Type.String(),
    type: Type.Literal("action"),
    title: WizardI18nStringSchema,
    description: Type.Optional(WizardI18nStringSchema),
    action: Type.String(),
    params: Type.Optional(Type.Record(Type.String(), WizardParamValueSchema)),
    successMessage: Type.Optional(WizardI18nStringSchema),
    failureMessage: Type.Optional(WizardI18nStringSchema),
  },
  { additionalProperties: false },
);

export const WizardStepSchema = Type.Union([
  WizardInfoStepSchema,
  WizardRadioStepSchema,
  WizardFormStepSchema,
  WizardActionStepSchema,
]);

export const WizardSpecSchema = Type.Object(
  {
    steps: Type.Array(WizardStepSchema, { minItems: 1 }),
    onComplete: WizardActionSchema,
  },
  { additionalProperties: false },
);

export type WizardParamRef = Static<typeof WizardParamRefSchema>;
export type WizardParamValue = Static<typeof WizardParamValueSchema>;
export type WizardAction = Static<typeof WizardActionSchema>;
export type WizardInfoStep = Static<typeof WizardInfoStepSchema>;
export type WizardRadioOption = Static<typeof WizardRadioOptionSchema>;
export type WizardRadioStep = Static<typeof WizardRadioStepSchema>;
export type WizardFormStep = Static<typeof WizardFormStepSchema>;
export type WizardActionStep = Static<typeof WizardActionStepSchema>;
export type WizardStep = Static<typeof WizardStepSchema>;
export type WizardSpec = Static<typeof WizardSpecSchema>;
