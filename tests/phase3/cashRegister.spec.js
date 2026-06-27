import { test, expect } from '../fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('Phase 3 - Cash Register', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
  });

  test('3.12.1 - Cash register table exists', async () => {
    const d = db(window);
    const result = await d.run(
      `INSERT INTO cash_registers (opening_balance, status) VALUES (?, ?)`,
      [500, 'open']
    );
    expect(result.lastInsertRowid).toBeGreaterThan(0);
  });

  test('3.12.2 - Can query open register', async () => {
    const d = db(window);
    const ts = Date.now();
    await d.run(
      `INSERT INTO cash_registers (opening_balance, status, opened_at) VALUES (?, ?, NOW())`,
      [1000, 'open']
    );
    const open = await d.get(
      `SELECT * FROM cash_registers WHERE status = 'open' ORDER BY id DESC LIMIT 1`
    );
    expect(open).not.toBeNull();
    expect(Number(open.opening_balance)).toBe(1000);
  });

  test('3.12.3 - Cash register page exists in sidebar', async () => {
    await window.click('text=الخزينة');
    await window.waitForTimeout(500);
    const body = await window.locator('body').textContent();
    expect(body).toContain('الخزينة');
  });

  test('3.12.4 - Can update closing balance', async () => {
    const d = db(window);
    const result = await d.run(
      `INSERT INTO cash_registers (opening_balance, status) VALUES (?, ?)`,
      [300, 'open']
    );
    await d.run(
      `UPDATE cash_registers SET closing_balance = ?, status = 'closed', closed_at = NOW() WHERE id = ?`,
      [350, result.lastInsertRowid]
    );
    const closed = await d.get(`SELECT * FROM cash_registers WHERE id = ?`, [result.lastInsertRowid]);
    expect(Number(closed.closing_balance)).toBe(350);
    expect(closed.status).toBe('closed');
  });

  test('3.12.5 - Cash movements can be recorded for a register', async () => {
    const d = db(window);
    const regResult = await d.run(
      `INSERT INTO cash_registers (opening_balance, status) VALUES (?, ?)`,
      [200, 'open']
    );
    const regId = regResult.lastInsertRowid;
    await d.run(
      `INSERT INTO cashier_movements (register_id, type, amount, reason) VALUES (?, ?, ?, ?)`,
      [regId, 'in', 100, 'Customer payment']
    );
    await d.run(
      `INSERT INTO cashier_movements (register_id, type, amount, reason) VALUES (?, ?, ?, ?)`,
      [regId, 'out', 50, 'Change given']
    );
    const movements = await d.all(
      `SELECT * FROM cashier_movements WHERE register_id = ? ORDER BY id`,
      [regId]
    );
    expect(movements.length).toBe(2);
    expect(Number(movements[0].amount)).toBe(100);
    expect(movements[0].type).toBe('in');
    expect(Number(movements[1].amount)).toBe(50);
    expect(movements[1].type).toBe('out');
  });
});
