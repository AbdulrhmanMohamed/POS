import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const ADMIN_PAGES = ['settings', 'auditLogs', 'purchaseOrders', 'inventory', 'expenses', 'workers', 'reports', 'chartOfAccounts'];

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      login: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    {
      name: 'pos-auth',
    }
  )
);

export function isAdmin() {
  const u = useAuthStore.getState().user;
  return u?.role === 'admin';
}

export function canAccess(page) {
  const u = useAuthStore.getState().user;
  if (!u) return false;
  if (u.role === 'admin') return true;
  return !ADMIN_PAGES.includes(page);
}
