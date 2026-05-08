export type BffQuerySource<TData> = {
  kind: "bff";
  path: string;
  request: (signal: AbortSignal) => Promise<TData>;
};

export type DataFabricBffTransport = <TData>(
  source: BffQuerySource<TData>,
  signal: AbortSignal,
) => Promise<TData>;

export function createBffQuerySource<TData>(
  path: string,
  request: (signal: AbortSignal) => Promise<TData>,
): BffQuerySource<TData> {
  return {
    kind: "bff",
    path,
    request,
  };
}

export const executeBffQuerySource: DataFabricBffTransport = (source, signal) => {
  if (signal.aborted) {
    throw new DOMException("request aborted", "AbortError");
  }
  return source.request(signal);
};
