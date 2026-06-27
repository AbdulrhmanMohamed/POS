import { create } from 'zustand';

export const useConfirmStore = create((set) => ({
  visible: false,
  message: '',
  resolve: null,
  confirm: (message) => new Promise((resolve) => {
    set({ visible: true, message, resolve });
  }),
  handleConfirm: () => {
    set((state) => {
      if (state.resolve) state.resolve(true);
      return { visible: false, message: '', resolve: null };
    });
  },
  handleCancel: () => {
    set((state) => {
      if (state.resolve) state.resolve(false);
      return { visible: false, message: '', resolve: null };
    });
  },
}));
