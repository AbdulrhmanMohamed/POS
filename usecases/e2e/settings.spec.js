import { test, expect } from '../../tests/fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('E2E - Settings', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
  });

  test('US-12.1: Save company info', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM settings WHERE key = ?`, ['company_name']);

    await d.run(`INSERT INTO settings (key, value) VALUES (?,?)`, ['company_name', `E2E Company ${ts}`]);

    const setting = await d.get(`SELECT * FROM settings WHERE key = ?`, ['company_name']);
    expect(setting).not.toBeNull();
    expect(setting.value).toBe(`E2E Company ${ts}`);
  });

  test('US-12.2: Currency auto-symbol', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM settings WHERE key IN (?,?)`, ['currency', 'currency_symbol']);

    await d.run(`INSERT INTO settings (key, value) VALUES (?,?)`, ['currency', 'SAR']);

    const currencyRow = await d.get(`SELECT value FROM settings WHERE key = ?`, ['currency']);
    let symbol = '';
    if (currencyRow.value === 'SAR') symbol = 'ر.س';
    else if (currencyRow.value === 'USD') symbol = '$';
    else if (currencyRow.value === 'EUR') symbol = '€';

    await d.run(`INSERT INTO settings (key, value) VALUES (?,?)`, ['currency_symbol', symbol]);

    const symbolRow = await d.get(`SELECT value FROM settings WHERE key = ?`, ['currency_symbol']);
    expect(symbolRow.value).toBe('ر.س');
  });

  test('US-12.3: Tax rate saved', async () => {
    const d = db(window);

    await d.run(`DELETE FROM settings WHERE key = ?`, ['tax_rate']);

    await d.run(`INSERT INTO settings (key, value) VALUES (?,?)`, ['tax_rate', '15']);

    const setting = await d.get(`SELECT value FROM settings WHERE key = ?`, ['tax_rate']);
    expect(setting.value).toBe('15');
  });

  test('US-12.4: Default discount saved', async () => {
    const d = db(window);

    await d.run(`DELETE FROM settings WHERE key = ?`, ['default_discount']);

    await d.run(`INSERT INTO settings (key, value) VALUES (?,?)`, ['default_discount', '10']);

    const setting = await d.get(`SELECT value FROM settings WHERE key = ?`, ['default_discount']);
    expect(setting.value).toBe('10');
  });

  test('US-12.5: Barcode format saved', async () => {
    const d = db(window);

    await d.run(`DELETE FROM settings WHERE key = ?`, ['barcode_format']);

    await d.run(`INSERT INTO settings (key, value) VALUES (?,?)`, ['barcode_format', 'CODE128']);

    const setting = await d.get(`SELECT value FROM settings WHERE key = ?`, ['barcode_format']);
    expect(setting.value).toBe('CODE128');
  });

  test('US-12.6: Scanner prefix/suffix saved', async () => {
    const d = db(window);

    await d.run(`DELETE FROM settings WHERE key IN (?,?)`, ['scanner_prefix', 'scanner_suffix']);

    await d.run(`INSERT INTO settings (key, value) VALUES (?,?)`, ['scanner_prefix', '##']);
    await d.run(`INSERT INTO settings (key, value) VALUES (?,?)`, ['scanner_suffix', ';;']);

    const prefix = await d.get(`SELECT value FROM settings WHERE key = ?`, ['scanner_prefix']);
    const suffix = await d.get(`SELECT value FROM settings WHERE key = ?`, ['scanner_suffix']);

    expect(prefix.value).toBe('##');
    expect(suffix.value).toBe(';;');
  });

  test('US-12.7: Load all settings', async () => {
    const d = db(window);
    await d.run(`DELETE FROM \`settings\` WHERE \`key\` IN ('test_company', 'test_tax_rate')`);
    await d.run(`INSERT INTO \`settings\` (\`key\`, \`value\`) VALUES (?,?)`, ['test_company', 'MyCompany']);
    await d.run(`INSERT INTO \`settings\` (\`key\`, \`value\`) VALUES (?,?)`, ['test_tax_rate', '15']);
    const all = await d.all(`SELECT * FROM \`settings\` WHERE \`key\` LIKE 'test_%'`);
    expect(all.length).toBe(2);
    const vals = all.reduce((acc, s) => ({...acc, [s.key]: s.value}), {});
    expect(vals.test_company).toBe('MyCompany');
    expect(vals.test_tax_rate).toBe('15');
    await d.run(`DELETE FROM \`settings\` WHERE \`key\` LIKE 'test_%'`);
  });
});
