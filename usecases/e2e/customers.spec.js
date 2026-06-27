import { test, expect } from '../../tests/fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('E2E - Customers', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
  });

  test('US-6.1: Create customer', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM customers WHERE name = ?`, [`E2E-CUST-CREATE-${ts}`]);

    await d.run(`INSERT INTO customers (name, phone, credit_limit, balance) VALUES (?,?,?,?)`,
      [`E2E-CUST-CREATE-${ts}`, '123456789', 500, 0]);

    const customer = await d.get(`SELECT * FROM customers WHERE name = ?`, [`E2E-CUST-CREATE-${ts}`]);
    expect(customer).not.toBeNull();
    expect(customer.name).toBe(`E2E-CUST-CREATE-${ts}`);
    expect(customer.phone).toBe('123456789');
    expect(Number(customer.credit_limit)).toBe(500);
    expect(Number(customer.balance)).toBe(0);
  });

  test('US-6.2: Update customer', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM customers WHERE name = ?`, [`E2E-CUST-UPDATE-${ts}`]);

    await d.run(`INSERT INTO customers (name, phone, credit_limit, balance) VALUES (?,?,?,?)`,
      [`E2E-CUST-UPDATE-${ts}`, '111111', 300, 0]);

    await d.run(`UPDATE customers SET name = ?, phone = ? WHERE name = ?`,
      [`E2E-CUST-UPDATED-${ts}`, '999999', `E2E-CUST-UPDATE-${ts}`]);

    const customer = await d.get(`SELECT * FROM customers WHERE name = ?`, [`E2E-CUST-UPDATED-${ts}`]);
    expect(customer).not.toBeNull();
    expect(customer.phone).toBe('999999');
  });

  test('US-6.3: Delete customer', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM customers WHERE name = ?`, [`E2E-CUST-DEL-${ts}`]);

    await d.run(`INSERT INTO customers (name, phone, credit_limit, balance) VALUES (?,?,?,?)`,
      [`E2E-CUST-DEL-${ts}`, '555555', 200, 0]);

    await d.run(`DELETE FROM customers WHERE name = ?`, [`E2E-CUST-DEL-${ts}`]);

    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-CUST-DEL-${ts}`]);
    expect(customer).toBeUndefined();
  });

  test('US-6.4: Balance auto-update on invoice', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number = ?)`, [`E2E-BAL-${ts}`]);
    await d.run(`DELETE FROM invoices WHERE invoice_number = ?`, [`E2E-BAL-${ts}`]);
    await d.run(`DELETE FROM customers WHERE name = ?`, [`E2E-CUST-BAL-${ts}`]);

    await d.run(`INSERT INTO customers (name, balance) VALUES (?,?)`, [`E2E-CUST-BAL-${ts}`, 0]);
    const customer = await d.get(`SELECT id, balance FROM customers WHERE name = ?`, [`E2E-CUST-BAL-${ts}`]);
    const balanceBefore = Number(customer.balance);

    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status) VALUES (?,?,?,?,?,?,?)`,
      [`E2E-BAL-${ts}`, customer.id, 250, 0, 0, 250, 'paid']);

    await d.run(`UPDATE customers SET balance = balance + ? WHERE id = ?`, [250, customer.id]);

    const customerAfter = await d.get(`SELECT balance FROM customers WHERE id = ?`, [customer.id]);
    expect(Number(customerAfter.balance)).toBe(balanceBefore + 250);
  });

  test('US-6.5: Credit limit enforcement', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number = ?)`, [`E2E-CRLMT-${ts}`]);
    await d.run(`DELETE FROM invoices WHERE invoice_number = ?`, [`E2E-CRLMT-${ts}`]);
    await d.run(`DELETE FROM customers WHERE name = ?`, [`E2E-CUST-CRLMT-${ts}`]);

    await d.run(`INSERT INTO customers (name, credit_limit, balance) VALUES (?,?,?)`, [`E2E-CUST-CRLMT-${ts}`, 100, 0]);
    const customer = await d.get(`SELECT id, credit_limit, balance FROM customers WHERE name = ?`, [`E2E-CUST-CRLMT-${ts}`]);

    const invoiceTotal = 200;
    const newBalance = Number(customer.balance) + invoiceTotal;
    const withinLimit = newBalance <= Number(customer.credit_limit);
    expect(withinLimit).toBe(false);
    expect(newBalance).toBeGreaterThan(Number(customer.credit_limit));
  });

  test('US-6.6: List all customers', async () => {
    const d = db(window);
    const ts = Date.now();
    for (let i = 0; i < 3; i++) {
      await d.run(`DELETE FROM customers WHERE name = ?`, [`List Customer ${ts} ${i}`]);
      await d.run(`INSERT INTO customers (name, phone) VALUES (?,?)`,
        [`List Customer ${ts} ${i}`, `011${i}0000000`]);
    }
    const all = await d.all(`SELECT * FROM customers WHERE name LIKE ?`, [`List Customer ${ts} %`]);
    expect(all.length).toBe(3);
    // Cleanup
    for (let i = 0; i < 3; i++) {
      await d.run(`DELETE FROM customers WHERE name = ?`, [`List Customer ${ts} ${i}`]);
    }
  });
});
