import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  approveDeviceRequest,
  rejectDeviceRequest,
  removeDevice,
  revokeDeviceToken,
  rotateDeviceToken,
  saveSettings,
  testEndpoint,
  testSettingsConnection,
  updateEndpoint,
} from "@/api";
import type { DeckGoRuntimeEndpointPutRequest, DeckGoSettings } from "@/api-types";
import { invalidateModule, mutationDefaults } from "../shared";
import { settingsKeys } from "./keys";

export function useSaveSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (settings: DeckGoSettings) => saveSettings(settings),
    onSuccess: async () => {
      await invalidateModule(queryClient, settingsKeys.all());
    },
  });
}

export function useTestSettingsConnectionMutation() {
  return useMutation({
    ...mutationDefaults,
    mutationFn: ({ token, url }: { token: string; url: string }) =>
      testSettingsConnection(url, token),
  });
}

export function useUpdateEndpointMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...mutationDefaults,
    mutationFn: (payload: DeckGoRuntimeEndpointPutRequest) => updateEndpoint(payload),
    onSuccess: async () => {
      await invalidateModule(queryClient, settingsKeys.all());
    },
  });
}

export function useTestEndpointMutation() {
  return useMutation({
    ...mutationDefaults,
    mutationFn: (payload?: Parameters<typeof testEndpoint>[0]) => testEndpoint(payload),
  });
}

export function useDeviceActionMutations() {
  const queryClient = useQueryClient();
  const invalidateDevices = async () => {
    await invalidateModule(queryClient, settingsKeys.all(), [
      settingsKeys.devices(),
      settingsKeys.selfDevice(),
    ]);
  };
  return {
    approve: useMutation({
      ...mutationDefaults,
      mutationFn: (requestId: string) => approveDeviceRequest(requestId),
      onSuccess: invalidateDevices,
    }),
    reject: useMutation({
      ...mutationDefaults,
      mutationFn: (requestId: string) => rejectDeviceRequest(requestId),
      onSuccess: invalidateDevices,
    }),
    remove: useMutation({
      ...mutationDefaults,
      mutationFn: (deviceId: string) => removeDevice(deviceId),
      onSuccess: invalidateDevices,
    }),
    revokeToken: useMutation({
      ...mutationDefaults,
      mutationFn: ({ deviceId, role }: { deviceId: string; role: string }) =>
        revokeDeviceToken(deviceId, role),
      onSuccess: invalidateDevices,
    }),
    rotateToken: useMutation({
      ...mutationDefaults,
      mutationFn: ({ deviceId, role }: { deviceId: string; role: string }) =>
        rotateDeviceToken(deviceId, role),
      onSuccess: invalidateDevices,
    }),
  };
}
