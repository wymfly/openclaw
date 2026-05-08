import { useQuery } from "@tanstack/react-query";
import {
  fetchDevices,
  fetchEndpoint,
  fetchSelfDevice,
  fetchSettings,
  fetchSettingsVersion,
} from "@/api";
import type {
  DeckGoDevicesResponse,
  DeckGoRuntimeEndpointResponse,
  DeckGoSelfDeviceResponse,
  DeckGoSettingsResponse,
  DeckGoSettingsVersionResponse,
} from "@/api-types";
import { useDataFabricTransports } from "../../client/scoped-query-provider";
import type { DeckQueryScope } from "../../contracts/query-keys";
import {
  bffQueryOptions,
  bffSource,
  type DataFabricBffTransport,
  type ModuleQueryOptions,
} from "../shared";
import { settingsKeys } from "./keys";

export function settingsQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoSettingsResponse>(
    bff,
    bffSource("GET /settings", () => fetchSettings()),
    settingsKeys.settings(scope),
    "config-authority",
  );
}

export function runtimeEndpointQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoRuntimeEndpointResponse>(
    bff,
    bffSource("GET /runtime/endpoint", () => fetchEndpoint()),
    settingsKeys.endpoint(scope),
    "config-authority",
  );
}

export function settingsVersionQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoSettingsVersionResponse>(
    bff,
    bffSource("GET /settings/version", () => fetchSettingsVersion()),
    settingsKeys.version(scope),
    "lazy-detail",
  );
}

export function devicesQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoDevicesResponse>(
    bff,
    bffSource("GET /devices", () => fetchDevices()),
    settingsKeys.devices(scope),
    "live-workbench",
  );
}

export function selfDeviceQueryOptions(bff: DataFabricBffTransport, scope?: DeckQueryScope) {
  return bffQueryOptions<DeckGoSelfDeviceResponse>(
    bff,
    bffSource("GET /devices/self", () => fetchSelfDevice()),
    settingsKeys.selfDevice(scope),
    "live-workbench",
  );
}

export function useSettingsQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...settingsQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useRuntimeEndpointQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...runtimeEndpointQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useSettingsVersionQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...settingsVersionQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}

export function useDevicesQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({ ...devicesQueryOptions(bff, options.scope), enabled: options.enabled ?? true });
}

export function useSelfDeviceQuery(options: ModuleQueryOptions = {}) {
  const { bff } = useDataFabricTransports();
  return useQuery({
    ...selfDeviceQueryOptions(bff, options.scope),
    enabled: options.enabled ?? true,
  });
}
