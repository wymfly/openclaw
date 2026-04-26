import { useSyncExternalStore } from "react";

type StoreUpdater<TState> =
  | Partial<TState>
  | TState
  | ((state: TState) => Partial<TState> | TState);

type StoreSetState<TState> = (updater: StoreUpdater<TState>, replace?: boolean) => void;
type StoreGetState<TState> = () => TState;
type StoreListener<TState> = (state: TState) => void;
type StoreSubscribe<TState> = (listener: StoreListener<TState>) => () => void;

export type LocalStoreHook<TState> = {
  (): TState;
  <TSelected>(selector: (state: TState) => TSelected): TSelected;
  getState: StoreGetState<TState>;
  setState: StoreSetState<TState>;
  subscribe: StoreSubscribe<TState>;
  destroy: () => void;
};

export function createLocalStore<TState>(
  initializer: (set: StoreSetState<TState>, get: StoreGetState<TState>) => TState,
): LocalStoreHook<TState> {
  let state = {} as TState;
  const listeners = new Set<StoreListener<TState>>();

  const getState: StoreGetState<TState> = () => state;

  const setState: StoreSetState<TState> = (updater, replace = false) => {
    const nextPartial =
      typeof updater === "function"
        ? (updater as (currentState: TState) => Partial<TState> | TState)(state)
        : updater;
    if (nextPartial === state) {
      return;
    }

    const nextState = replace
      ? (nextPartial as TState)
      : ({
          ...state,
          ...nextPartial,
        } as TState);

    if (Object.is(nextState, state)) {
      return;
    }

    state = nextState;
    for (const listener of listeners) {
      listener(state);
    }
  };

  const subscribe: StoreSubscribe<TState> = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  state = initializer(setState, getState);

  function useStore<TSelected = TState>(selector?: (state: TState) => TSelected): TSelected {
    const getSnapshot = () => (selector ? selector(state) : (state as unknown as TSelected));
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  }

  const hook = useStore as LocalStoreHook<TState>;
  hook.getState = getState;
  hook.setState = setState;
  hook.subscribe = subscribe;
  hook.destroy = () => {
    listeners.clear();
  };

  return hook;
}
