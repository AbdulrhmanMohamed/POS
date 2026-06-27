import { create } from 'zustand';

let nextId = 0;

export const useToastStore = create((set) => ({
  toasts: [],
  addToast: (message, type = 'info', duration = 4000) => {
    const id = ++nextId;
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, duration);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}));
