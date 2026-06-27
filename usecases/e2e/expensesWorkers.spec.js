import { test, expect } from '../../tests/fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('E2E - Expenses & Workers', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
  });

  test('US-11.1: Create expense', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM expenses WHERE description = ?`, [`E2E-EXP-${ts}`]);

    await d.run(`INSERT INTO expenses (description, category, amount, date) VALUES (?,?,?,?)`,
      [`E2E-EXP-${ts}`, 'Utilities', 150, new Date().toISOString().split('T')[0]]);

    const expense = await d.get(`SELECT * FROM expenses WHERE description = ?`, [`E2E-EXP-${ts}`]);
    expect(expense).not.toBeNull();
    expect(expense.category).toBe('Utilities');
    expect(Number(expense.amount)).toBe(150);
  });

  test('US-11.2: Update/delete expense', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM expenses WHERE description LIKE ?`, [`E2E-EXP-UPD-${ts}%`]);

    await d.run(`INSERT INTO expenses (description, category, amount, date) VALUES (?,?,?,?)`,
      [`E2E-EXP-UPD-${ts}`, 'Rent', 500, new Date().toISOString().split('T')[0]]);

    await d.run(`UPDATE expenses SET amount = ?, category = ? WHERE description = ?`,
      [600, 'Rent Updated', `E2E-EXP-UPD-${ts}`]);

    const updated = await d.get(`SELECT * FROM expenses WHERE description = ?`, [`E2E-EXP-UPD-${ts}`]);
    expect(Number(updated.amount)).toBe(600);
    expect(updated.category).toBe('Rent Updated');

    await d.run(`DELETE FROM expenses WHERE description = ?`, [`E2E-EXP-UPD-${ts}`]);
    const deleted = await d.get(`SELECT id FROM expenses WHERE description = ?`, [`E2E-EXP-UPD-${ts}`]);
    expect(deleted).toBeUndefined();
  });

  test('US-11.3: Create worker', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM workers WHERE name = ?`, [`E2E-WRK-${ts}`]);

    await d.run(`INSERT INTO workers (name, phone, position, salary) VALUES (?,?,?,?)`,
      [`E2E-WRK-${ts}`, '0555000111', 'Cashier', 2000]);

    const worker = await d.get(`SELECT * FROM workers WHERE name = ?`, [`E2E-WRK-${ts}`]);
    expect(worker).not.toBeNull();
    expect(worker.phone).toBe('0555000111');
    expect(worker.position).toBe('Cashier');
    expect(Number(worker.salary)).toBe(2000);
  });

  test('US-11.4: Deactivate worker', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM workers WHERE name = ?`, [`E2E-WRK-DEACT-${ts}`]);

    await d.run(`INSERT INTO workers (name, phone, position, salary, is_active) VALUES (?,?,?,?,?)`,
      [`E2E-WRK-DEACT-${ts}`, '0555000222', 'Sales', 1800, 1]);

    await d.run(`UPDATE workers SET is_active = ? WHERE name = ?`, [0, `E2E-WRK-DEACT-${ts}`]);

    const worker = await d.get(`SELECT is_active FROM workers WHERE name = ?`, [`E2E-WRK-DEACT-${ts}`]);
    expect(Number(worker.is_active)).toBe(0);
  });

  test('US-11.5: Record worker payment', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM worker_payments WHERE worker_id IN (SELECT id FROM workers WHERE name = ?)`, [`E2E-WRK-PAY-${ts}`]);
    await d.run(`DELETE FROM workers WHERE name = ?`, [`E2E-WRK-PAY-${ts}`]);

    const wrk = await d.run(`INSERT INTO workers (name, salary) VALUES (?,?)`, [`E2E-WRK-PAY-${ts}`, 2000]);
    const workerId = wrk.lastInsertRowid;

    await d.run(`INSERT INTO worker_payments (worker_id, month, amount) VALUES (?,?,?)`,
      [workerId, '2026-01', 2000]);

    const payment = await d.get(`SELECT * FROM worker_payments WHERE worker_id = ? AND month = ?`, [workerId, '2026-01']);
    expect(payment).not.toBeNull();
    expect(Number(payment.amount)).toBe(2000);
  });

  test('US-11.6: Duplicate payment rejection', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM worker_payments WHERE worker_id IN (SELECT id FROM workers WHERE name = ?)`, [`E2E-WRK-DUP-${ts}`]);
    await d.run(`DELETE FROM workers WHERE name = ?`, [`E2E-WRK-DUP-${ts}`]);

    const wrk = await d.run(`INSERT INTO workers (name, salary) VALUES (?,?)`, [`E2E-WRK-DUP-${ts}`, 2000]);
    const workerId = wrk.lastInsertRowid;

    await d.run(`INSERT INTO worker_payments (worker_id, month, amount) VALUES (?,?,?)`,
      [workerId, '2026-02', 2000]);

    let error = null;
    try {
      await d.run(`INSERT INTO worker_payments (worker_id, month, amount) VALUES (?,?,?)`,
        [workerId, '2026-02', 2000]);
    } catch (e) {
      error = e;
    }
    expect(error).not.toBeNull();
  });

  test('US-11.7: Worker payment in daily report', async () => {
    const d = db(window);
    const ts = Date.now();
    const today = new Date().toISOString().split('T')[0];

    await d.run(`DELETE FROM worker_payments WHERE worker_id IN (SELECT id FROM workers WHERE name = ?)`, [`E2E-WRK-DR-${ts}`]);
    await d.run(`DELETE FROM workers WHERE name = ?`, [`E2E-WRK-DR-${ts}`]);

    const wrk = await d.run(`INSERT INTO workers (name, salary) VALUES (?,?)`, [`E2E-WRK-DR-${ts}`, 3000]);
    const workerId = wrk.lastInsertRowid;

    await d.run(`INSERT INTO worker_payments (worker_id, month, amount, created_at) VALUES (?,?,?,?)`,
      [workerId, '2026-01', 3000, today]);

    const wageSum = await d.get(
      `SELECT COALESCE(SUM(amount), 0) as total FROM worker_payments WHERE DATE(created_at) = ?`, [today]);

    expect(Number(wageSum.total)).toBe(3000);
  });

  test('US-11.8: Update worker details', async () => {
    const d = db(window);
    const ts = Date.now();
    await d.run(`DELETE FROM workers WHERE name = ?`, [`Worker Update ${ts}`]);
    await d.run(`INSERT INTO workers (name, phone, position, salary) VALUES (?,?,?,?)`,
      [`Worker Update ${ts}`, '0100000000', 'Cashier', 3000]);
    const worker = await d.get(`SELECT id FROM workers WHERE name = ?`, [`Worker Update ${ts}`]);
    await d.run(`UPDATE workers SET phone = ?, position = ?, salary = ? WHERE id = ?`,
      ['0101111111', 'Senior Cashier', 3500, worker.id]);
    const updated = await d.get(`SELECT * FROM workers WHERE id = ?`, [worker.id]);
    expect(updated.phone).toBe('0101111111');
    expect(updated.position).toBe('Senior Cashier');
    expect(Number(updated.salary)).toBe(3500);
    await d.run(`DELETE FROM workers WHERE id = ?`, [worker.id]);
  });
});
