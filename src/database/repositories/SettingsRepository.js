import dbManager from '../DB.js';
import { SettingsSchema } from '../schemas.js';
import { Sanitizer } from '../../utils/sanitizer.js';

export class SettingsRepository {
  get(key) {
    const safeKey = Sanitizer.sanitizeString(key, 100);
    const row = dbManager.get('SELECT value FROM settings WHERE key = ?', [safeKey]);
    return row?.value || null;
  }

  getAll() {
    const rows = dbManager.all('SELECT key, value FROM settings');
    const settings = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });
    return settings;
  }

  set(key, value) {
    const safeKey = Sanitizer.sanitizeString(key, 100);
    const safeValue = Sanitizer.sanitizeString(value, 1000);
    dbManager.run(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
    `, [safeKey, safeValue, safeValue]);
    return { key: safeKey, value: safeValue };
  }

  setMultiple(settings) {
    const transaction = dbManager.transaction(() => {
      Object.entries(settings).forEach(([key, value]) => {
        this.set(key, value);
      });
    });
    transaction();
    return this.getAll();
  }
}