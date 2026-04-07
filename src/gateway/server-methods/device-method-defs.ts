import type { MethodMetadata } from "../method-registry.js";
import { PAIRING_SCOPE } from "../method-scopes.js";
import {
  DevicePairApproveParamsSchema,
  DevicePairApproveResultSchema,
  DevicePairListParamsSchema,
  DevicePairListResultSchema,
  DevicePairRejectParamsSchema,
  DevicePairRejectResultSchema,
  DevicePairRemoveParamsSchema,
  DevicePairRemoveResultSchema,
  DeviceTokenRevokeParamsSchema,
  DeviceTokenRevokeResultSchema,
  DeviceTokenRotateParamsSchema,
  DeviceTokenRotateResultSchema,
} from "../protocol/schema/devices.js";

export const deviceMethodDefs: Record<string, MethodMetadata> = {
  "device.pair.list": {
    params: DevicePairListParamsSchema,
    result: DevicePairListResultSchema,
    scope: PAIRING_SCOPE,
  },
  "device.pair.approve": {
    params: DevicePairApproveParamsSchema,
    result: DevicePairApproveResultSchema,
    scope: PAIRING_SCOPE,
  },
  "device.pair.reject": {
    params: DevicePairRejectParamsSchema,
    result: DevicePairRejectResultSchema,
    scope: PAIRING_SCOPE,
  },
  "device.pair.remove": {
    params: DevicePairRemoveParamsSchema,
    result: DevicePairRemoveResultSchema,
    scope: PAIRING_SCOPE,
  },
  "device.token.rotate": {
    params: DeviceTokenRotateParamsSchema,
    result: DeviceTokenRotateResultSchema,
    scope: PAIRING_SCOPE,
  },
  "device.token.revoke": {
    params: DeviceTokenRevokeParamsSchema,
    result: DeviceTokenRevokeResultSchema,
    scope: PAIRING_SCOPE,
  },
};
