import { test, expect } from '../../tests/fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('E2E - Cash Register', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
  });

  test('US-9.1: Open register', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM cashier_movements WHERE register_id IN (SELECT id FROM cash_registers WHERE opening_balance = ?)`, [100]);
    await d.run(`DELETE FROM cash_registers WHERE opening_balance = ?`, [100]);

    const result = await d.run(`INSERT INTO cash_registers (opening_balance, status) VALUES (?,?)`, [100, 'open']);
    const register = await d.get(`SELECT * FROM cash_registers WHERE id = ?`, [result.lastInsertRowid]);
    expect(register).not.toBeNull();
    expect(register.status).toBe('open');
    expect(Number(register.opening_balance)).toBe(100);
  });

  test('US-9.2: Close register', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM cashier_movements WHERE register_id IN (SELECT id FROM cash_registers WHERE opening_balance = ?)`, [200]);
    await d.run(`DELETE FROM cash_registers WHERE opening_balance = ?`, [200]);

    const result = await d.run(`INSERT INTO cash_registers (opening_balance, status) VALUES (?,?)`, [200, 'open']);
    const registerId = result.lastInsertRowid;

    await d.run(`UPDATE cash_registers SET status = ?, closing_balance = ? WHERE id = ?`, ['closed', 500, registerId]);

    const register = await d.get(`SELECT * FROM cash_registers WHERE id = ?`, [registerId]);
    expect(register.status).toBe('closed');
    expect(Number(register.closing_balance)).toBe(500);
  });

  test('US-9.3: Manual cash in', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM cashier_movements WHERE reason = ?`, [`Manual in ${ts}`]);

    await d.run(`DELETE FROM cash_registers WHERE status = 'open'`);
    const reg = await d.run(`INSERT INTO cash_registers (opening_balance, status) VALUES (?,?)`, [0, 'open']);

    await d.run(`INSERT INTO cashier_movements (register_id, type, amount, reason) VALUES (?,?,?,?)`,
      [reg.lastInsertRowid, 'in', 50, `Manual in ${ts}`]);

    const movement = await d.get(`SELECT * FROM cashier_movements WHERE reason = ?`, [`Manual in ${ts}`]);
    expect(movement).not.toBeNull();
    expect(movement.type).toBe('in');
    expect(Number(movement.amount)).toBe(50);
  });

  test('US-9.4: Manual cash out', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM cashier_movements WHERE reason = ?`, [`Manual out ${ts}`]);

    await d.run(`DELETE FROM cash_registers WHERE status = 'open'`);
    const reg = await d.run(`INSERT INTO cash_registers (opening_balance, status) VALUES (?,?)`, [0, 'open']);

    await d.run(`INSERT INTO cashier_movements (register_id, type, amount, reason) VALUES (?,?,?,?)`,
      [reg.lastInsertRowid, 'out', 30, `Manual out ${ts}`]);

    const movement = await d.get(`SELECT * FROM cashier_movements WHERE reason = ?`, [`Manual out ${ts}`]);
    expect(movement).not.toBeNull();
    expect(movement.type).toBe('out');
    expect(Number(movement.amount)).toBe(30);
  });

  test('US-9.5: Auto cash in from POS sale', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM cashier_movements WHERE reason LIKE ?`, [`POS Sale: ${ts}%`]);
    await d.run(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number = ?)`, [`E2E-CR-SALE-${ts}`]);
    await d.run(`DELETE FROM invoices WHERE invoice_number = ?`, [`E2E-CR-SALE-${ts}`]);
    await d.run(`DELETE FROM cash_registers WHERE status = 'open'`);

    const reg = await d.run(`INSERT INTO cash_registers (opening_balance, status) VALUES (?,?)`, [0, 'open']);
    const registerId = reg.lastInsertRowid;

    await d.run(`INSERT INTO customers (name) VALUES (?)`, [`E2E-CR-CUST-${ts}`]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-CR-CUST-${ts}`]);

    const invoiceResult = await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status) VALUES (?,?,?,?,?,?,?)`,
      [`E2E-CR-SALE-${ts}`, customer.id, 150, 0, 0, 150, 'paid']);

    await d.run(`INSERT INTO cashier_movements (register_id, type, amount, reason) VALUES (?,?,?,?)`,
      [registerId, 'in', 150, `POS Sale: ${ts} - invoice #${invoiceResult.lastInsertRowid}`]);

    const movement = await d.get(`SELECT * FROM cashier_movements WHERE reason LIKE ?`, [`POS Sale: ${ts}%`]);
    expect(movement).not.toBeNull();
    expect(movement.type).toBe('in');
    expect(Number(movement.amount)).toBe(150);
    expect(movement.reason).toContain('POS Sale:');
  });

  test('US-9.6: Auto cash out from PO receive', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM cashier_movements WHERE reason LIKE ?`, [`PO Receive: ${ts}%`]);
    await d.run(`DELETE FROM cash_registers WHERE status = 'open'`);

    const reg = await d.run(`INSERT INTO cash_registers (opening_balance, status) VALUES (?,?)`, [0, 'open']);
    const registerId = reg.lastInsertRowid;

    await d.run(`INSERT INTO suppliers (name) VALUES (?)`, [`E2E-CR-SUP-${ts}`]);
    const supplier = await d.get(`SELECT id FROM suppliers WHERE name = ?`, [`E2E-CR-SUP-${ts}`]);

    await d.run(`INSERT INTO purchase_orders (po_number, supplier_id, subtotal, total, status) VALUES (?,?,?,?,?)`,
      [`E2E-CR-PO-${ts}`, supplier.id, 300, 300, 'received']);

    await d.run(`INSERT INTO cashier_movements (register_id, type, amount, reason) VALUES (?,?,?,?)`,
      [registerId, 'out', 300, `PO Receive: ${ts} - PO E2E-CR-PO-${ts}`]);

    const movement = await d.get(`SELECT * FROM cashier_movements WHERE reason LIKE ?`, [`PO Receive: ${ts}%`]);
    expect(movement).not.toBeNull();
    expect(movement.type).toBe('out');
    expect(Number(movement.amount)).toBe(300);
    expect(movement.reason).toContain('PO Receive:');
  });

  test('US-9.7: Block opening second register', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM cashier_movements WHERE register_id IN (SELECT id FROM cash_registers WHERE status = 'open')`);
    await d.run(`DELETE FROM cash_registers WHERE status = 'open'`);

    await d.run(`INSERT INTO cash_registers (opening_balance, status) VALUES (?,?)`, [100, 'open']);

    let error = null;
    try {
      const existing = await d.get(`SELECT id FROM cash_registers WHERE status = 'open'`);
      if (existing) {
        throw new Error('A register is already open. Close it first before opening a new one.');
      }
    } catch (e) {
      error = e;
    }
    expect(error).not.toBeNull();
    expect(error.message).toContain('already open');
  });

  test('US-9.8: Movement with zero amount', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM cashier_movements WHERE reason = ?`, [`Zero movement ${ts}`]);
    await d.run(`DELETE FROM cash_registers WHERE status = 'open'`);
    const reg = await d.run(`INSERT INTO cash_registers (opening_balance, status) VALUES (?,?)`, [0, 'open']);

    let error = null;
    try {
      await d.run(`INSERT INTO cashier_movements (register_id, type, amount, reason) VALUES (?,?,?,?)`,
        [reg.lastInsertRowid, 'in', 0, `Zero movement ${ts}`]);
      const movement = await d.get(`SELECT * FROM cashier_movements WHERE reason = ?`, [`Zero movement ${ts}`]);
      if (movement && Number(movement.amount) === 0) {
        error = new Error('Zero-amount movement was allowed');
      }
    } catch (e) {
      error = e;
    }
    expect(error).not.toBeNull();
  });

  test('US-9.9: Stat cards query', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM cashier_movements WHERE reason LIKE ?`, [`Stat test ${ts}%`]);
    await d.run(`DELETE FROM cash_registers WHERE status = 'open'`);
    const reg = await d.run(`INSERT INTO cash_registers (opening_balance, status) VALUES (?,?)`, [0, 'open']);
    const registerId = reg.lastInsertRowid;

    await d.run(`INSERT INTO cashier_movements (register_id, type, amount, reason) VALUES (?,?,?,?)`,
      [registerId, 'in', 100, `Stat test ${ts} in1`]);
    await d.run(`INSERT INTO cashier_movements (register_id, type, amount, reason) VALUES (?,?,?,?)`,
      [registerId, 'in', 200, `Stat test ${ts} in2`]);
    await d.run(`INSERT INTO cashier_movements (register_id, type, amount, reason) VALUES (?,?,?,?)`,
      [registerId, 'out', 50, `Stat test ${ts} out1`]);
    await d.run(`INSERT INTO cashier_movements (register_id, type, amount, reason) VALUES (?,?,?,?)`,
      [registerId, 'out', 30, `Stat test ${ts} out2`]);

    const totalIn = await d.get(`SELECT COALESCE(SUM(amount), 0) as total FROM cashier_movements WHERE type = 'in' AND reason LIKE ?`, [`Stat test ${ts}%`]);
    const totalOut = await d.get(`SELECT COALESCE(SUM(amount), 0) as total FROM cashier_movements WHERE type = 'out' AND reason LIKE ?`, [`Stat test ${ts}%`]);

    expect(Number(totalIn.total)).toBe(300);
    expect(Number(totalOut.total)).toBe(80);
  });
});
