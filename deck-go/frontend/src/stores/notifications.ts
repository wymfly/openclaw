import { createLocalStore } from "./create-local-store";

export type ToastType = "info" | "success" | "warning" | "error";

export type Toast = {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  createdAt: number;
};

export type NotificationsState = {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  dismissToast: (id: string) => void;
};

let nextToastId = 0;

function scheduleDismiss(callback: () => void, duration: number) {
  const timer = globalThis.setTimeout(callback, duration);
  if (typeof (timer as { unref?: () => void }).unref === "function") {
    (timer as { unref: () => void }).unref();
  }
}

export const useNotificationsStore = createLocalStore<NotificationsState>((set) => ({
  toasts: [],
  addToast: (type, message, duration = 5000) => {
    const id = `toast-${++nextToastId}`;
    const toast: Toast = { id, type, message, duration, createdAt: Date.now() };
    set((state) => ({ toasts: [...state.toasts, toast] }));

    if (duration > 0) {
      scheduleDismiss(() => {
        set((state) => ({
          toasts: state.toasts.filter((item) => item.id !== id),
        }));
      }, duration);
    }
  },
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}));
