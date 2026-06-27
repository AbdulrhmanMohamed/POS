import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SettingsRepository } from '../database';

const CURRENCY_MAP = {
  SAR: { symbol: 'ر.س', label: 'SAR – ريال' },
  EGP: { symbol: 'ج.م', label: 'EGP – ج.م' },
  USD: { symbol: '$', label: 'USD – $' },
  EUR: { symbol: '€', label: 'EUR – €' },
  GBP: { symbol: '£', label: 'GBP – £' },
};

const defaults = {
  language: 'ar',
  theme: 'light',
  currency: 'SAR',
  currency_symbol: 'ر.س',
  company_name: '',
  company_phone: '',
  company_address: '',
  tax_rate: '0',
  default_discount: '0',
  invoice_prefix: 'INV',
  barcode_format: 'numeric12',
  scanner_prefix: '',
  scanner_suffix: '',
};

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      ...defaults,
      loaded: false,

      getCurrencySymbol: (currencyCode) => {
        return CURRENCY_MAP[currencyCode]?.symbol || currencyCode;
      },

      load: async () => {
        const fromDb = await SettingsRepository.getAll();
        if (fromDb && Object.keys(fromDb).length > 0) {
          const merged = { ...defaults, ...fromDb };
          if (merged.currency && CURRENCY_MAP[merged.currency]) {
            merged.currency_symbol = CURRENCY_MAP[merged.currency].symbol;
          }
          set({ ...merged, loaded: true });
        } else {
          set({ loaded: true });
        }
      },

      setSetting: async (key, value) => {
        const patch = { [key]: value };
        if (key === 'currency' && CURRENCY_MAP[value]) {
          patch.currency_symbol = CURRENCY_MAP[value].symbol;
        }
        set(patch);
        await SettingsRepository.set(key, value);
        if (key === 'currency') {
          await SettingsRepository.set('currency_symbol', patch.currency_symbol);
        }
      },

      setMultiple: async (updates) => {
        const patched = { ...updates };
        if (patched.currency && CURRENCY_MAP[patched.currency]) {
          patched.currency_symbol = CURRENCY_MAP[patched.currency].symbol;
        }
        set(patched);
        const entries = Object.entries(patched);
        await Promise.all(entries.map(([k, v]) => SettingsRepository.set(k, v)));
      },

      reset: () => {
        set(defaults);
      },
    }),
    {
      name: 'pos-settings',
    }
  )
);

export { CURRENCY_MAP };