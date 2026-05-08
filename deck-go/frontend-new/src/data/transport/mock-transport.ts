import type { BffQuerySource, DataFabricBffTransport } from "./bff";
import type { DataFabricGatewayRpcTransport, GatewayRpcQuerySource } from "./gateway-rpc";

export type DataFabricCallRecord = {
  kind: "bff" | "gateway-rpc";
  path?: string;
  method?: string;
};

export function createDataFabricCallRecorder(records: DataFabricCallRecord[] = []) {
  return {
    records,
    record(source: BffQuerySource<unknown> | GatewayRpcQuerySource) {
      if (source.kind === "bff") {
        records.push({ kind: "bff", path: source.path });
        return;
      }
      records.push({ kind: "gateway-rpc", method: source.method });
    },
  };
}

export function createRecordingBffTransport(
  delegate: DataFabricBffTransport,
  records: DataFabricCallRecord[],
): DataFabricBffTransport {
  const recorder = createDataFabricCallRecorder(records);
  return (source, signal) => {
    recorder.record(source as BffQuerySource<unknown>);
    return delegate(source, signal);
  };
}

export function createRecordingGatewayRpcTransport(
  delegate: DataFabricGatewayRpcTransport,
  records: DataFabricCallRecord[],
): DataFabricGatewayRpcTransport {
  const recorder = createDataFabricCallRecorder(records);
  return (source, signal) => {
    recorder.record(source);
    return delegate(source, signal);
  };
}
