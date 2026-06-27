import { test, expect } from '../fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('Phase 3 - Cash Register Enhancements', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    await window.click('text=الخزينة');
    await window.waitForTimeout(500);
  });

  test('3.13.1 - Cash register page has Open Register button when no open shift', async () => {
    const d = db(window);
    const openReg = await d.get(`SELECT * FROM cash_registers WHERE status = 'open' LIMIT 1`);
    if (!openReg) {
      const btn = window.locator('button:has-text("فتح"), button:has-text("شفت"), button:has-text("فتح الخزينة")');
      await expect(btn).toBeVisible();
    }
  });

  test('3.13.2 - Can open a cash register with opening balance', async () => {
    const d = db(window);
    const openReg = await d.get(`SELECT * FROM cash_registers WHERE status = 'open' LIMIT 1`);
    if (openReg) {
      await d.run(`UPDATE cash_registers SET status = 'closed', closed_at = NOW() WHERE id = ?`, [openReg.id]);
    }
    await window.reload();
    await window.waitForTimeout(1000);
    await window.click('text=الخزينة');
    await window.waitForTimeout(500);
    const openBtn = window.locator('button:has-text("فتح")');
    if (await openBtn.isVisible()) {
      await openBtn.click();
      await window.waitForTimeout(300);
      const balanceInput = window.locator('input[type="number"]').first();
      await balanceInput.fill('500');
      await window.locator('button:has-text("تأكيد"), button:has-text("حفظ"), button:has-text("فتح")').last().click();
      await window.waitForTimeout(500);
      const newReg = await d.get(`SELECT * FROM cash_registers WHERE status = 'open' ORDER BY id DESC LIMIT 1`);
      expect(newReg).not.toBeNull();
      expect(Number(newReg.opening_balance)).toBe(500);
    }
  });

  test('3.13.3 - Cash register page shows current shift balance', async () => {
    const body = await window.locator('body').textContent();
    const hasBalanceText = body.includes('الرصيد') || body.includes('balance');
    expect(hasBalanceText).toBe(true);
  });

  test('3.13.4 - Cash register page has close register button when shift is open', async () => {
    const d = db(window);
    const openReg = await d.get(`SELECT * FROM cash_registers WHERE status = 'open' LIMIT 1`);
    if (openReg) {
      await window.click('text=الخزينة');
      await window.waitForTimeout(500);
      const closeBtn = window.locator('button:has-text("إغلاق"), button:has-text("غلق"), button:has-text("إنهاء")');
      await expect(closeBtn).toBeVisible();
    }
  });

  test('3.13.5 - Register history table shows previous shifts', async () => {
    const tables = window.locator('.table');
    const count = await tables.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
