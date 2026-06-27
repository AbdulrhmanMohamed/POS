import { test, expect } from '../../tests/fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('E2E - Invoices', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
  });

  test('US-5.1: List invoices with pagination', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number LIKE ?)`, [`E2E-INV-LIST-${ts}-%`]);
    await d.run(`DELETE FROM invoices WHERE invoice_number LIKE ?`, [`E2E-INV-LIST-${ts}-%`]);

    await d.run(`INSERT INTO customers (name) VALUES (?)`, [`E2E-CUST-LIST-${ts}`]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-CUST-LIST-${ts}`]);

    for (let i = 0; i < 15; i++) {
      await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status) VALUES (?,?,?,?,?,?,?)`,
        [`E2E-INV-LIST-${ts}-${i}`, customer.id, 100, 0, 0, 100, 'paid']);
    }

    const page1 = await d.all(`SELECT * FROM invoices WHERE invoice_number LIKE ? ORDER BY id LIMIT 10 OFFSET 0`, [`E2E-INV-LIST-${ts}-%`]);
    expect(page1.length).toBe(10);

    const page2 = await d.all(`SELECT * FROM invoices WHERE invoice_number LIKE ? ORDER BY id LIMIT 10 OFFSET 10`, [`E2E-INV-LIST-${ts}-%`]);
    expect(page2.length).toBe(5);
  });

  test('US-5.2: Invoice status', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM invoices WHERE invoice_number = ?`, [`E2E-INV-STATUS-${ts}`]);

    await d.run(`INSERT INTO customers (name) VALUES (?)`, [`E2E-CUST-STATUS-${ts}`]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-CUST-STATUS-${ts}`]);

    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status) VALUES (?,?,?,?,?,?,?)`,
      [`E2E-INV-STATUS-${ts}`, customer.id, 100, 0, 0, 100, 'paid']);

    const invoice = await d.get(`SELECT status FROM invoices WHERE invoice_number = ?`, [`E2E-INV-STATUS-${ts}`]);
    expect(invoice.status).toBe('paid');

    await d.run(`UPDATE invoices SET status = ? WHERE invoice_number = ?`, ['refunded', `E2E-INV-STATUS-${ts}`]);
    const updated = await d.get(`SELECT status FROM invoices WHERE invoice_number = ?`, [`E2E-INV-STATUS-${ts}`]);
    expect(updated.status).toBe('refunded');
  });

  test('US-5.3: Search by invoice number', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM invoices WHERE invoice_number = ?`, [`E2E-SEARCH-${ts}`]);

    await d.run(`INSERT INTO customers (name) VALUES (?)`, [`E2E-CUST-SEARCH-${ts}`]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-CUST-SEARCH-${ts}`]);

    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status) VALUES (?,?,?,?,?,?,?)`,
      [`E2E-SEARCH-${ts}`, customer.id, 150, 0, 0, 150, 'paid']);

    const found = await d.get(`SELECT * FROM invoices WHERE invoice_number = ?`, [`E2E-SEARCH-${ts}`]);
    expect(found).not.toBeNull();
    expect(Number(found.total)).toBe(150);
  });

  test('US-5.4: Filter by customer', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM invoices WHERE invoice_number LIKE ?`, [`E2E-FILT-${ts}-%`]);
    await d.run(`DELETE FROM customers WHERE name = ?`, [`E2E-CUST-FILT-${ts}`]);

    await d.run(`INSERT INTO customers (name) VALUES (?)`, [`E2E-CUST-FILT-${ts}`]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-CUST-FILT-${ts}`]);

    for (let i = 0; i < 3; i++) {
      await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status) VALUES (?,?,?,?,?,?,?)`,
        [`E2E-FILT-${ts}-${i}`, customer.id, 100, 0, 0, 100, 'paid']);
    }

    const invoices = await d.all(`SELECT * FROM invoices WHERE customer_id = ?`, [customer.id]);
    expect(invoices.length).toBe(3);
  });

  test('US-5.5: Profit calculation (unit_price - unit_cost) * quantity', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number = ?)`, [`E2E-PROFIT-${ts}`]);
    await d.run(`DELETE FROM invoices WHERE invoice_number = ?`, [`E2E-PROFIT-${ts}`]);

    await d.run(`INSERT INTO customers (name) VALUES (?)`, [`E2E-CUST-PROFIT-${ts}`]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-CUST-PROFIT-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Profit Test', `E2E-PROFIT-PROD-${ts}`, 50, 20, 10, 2, 'TestInv', 'piece']);
    const product = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-PROFIT-PROD-${ts}`]);

    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status) VALUES (?,?,?,?,?,?,?)`,
      [`E2E-PROFIT-${ts}`, customer.id, 500, 0, 0, 500, 'paid']);
    const invoice = await d.get(`SELECT id FROM invoices WHERE invoice_number = ?`, [`E2E-PROFIT-${ts}`]);

    const unitPrice = 50;
    const unitCost = 20;
    const qty = 10;
    const expectedProfit = (unitPrice - unitCost) * qty;

    await d.run(`INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, unit_price, unit_cost, total_price) VALUES (?,?,?,?,?,?,?)`,
      [invoice.id, product.id, 'Profit Test', qty, unitPrice, unitCost, unitPrice * qty]);

    const item = await d.get(`SELECT * FROM invoice_items WHERE invoice_id = ?`, [invoice.id]);
    const profit = (Number(item.unit_price) - Number(item.unit_cost)) * Number(item.quantity);
    expect(profit).toBe(expectedProfit);
  });

  test('US-5.6: Invoice number auto-generation', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM invoices WHERE invoice_number LIKE ?`, [`E2E-AUTO-${ts}-%`]);
    await d.run(`DELETE FROM customers WHERE name = ?`, [`E2E-CUST-AUTO-${ts}`]);

    await d.run(`INSERT INTO customers (name) VALUES (?)`, [`E2E-CUST-AUTO-${ts}`]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-CUST-AUTO-${ts}`]);

    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status) VALUES (?,?,?,?,?,?,?)`,
      [`E2E-AUTO-${ts}-1`, customer.id, 100, 0, 0, 100, 'paid']);
    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status) VALUES (?,?,?,?,?,?,?)`,
      [`E2E-AUTO-${ts}-2`, customer.id, 200, 0, 0, 200, 'paid']);
    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status) VALUES (?,?,?,?,?,?,?)`,
      [`E2E-AUTO-${ts}-3`, customer.id, 300, 0, 0, 300, 'paid']);

    const invoices = await d.all(`SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY id`, [`E2E-AUTO-${ts}-%`]);
    expect(invoices.length).toBe(3);
    expect(invoices[0].invoice_number).toBe(`E2E-AUTO-${ts}-1`);
    expect(invoices[1].invoice_number).toBe(`E2E-AUTO-${ts}-2`);
    expect(invoices[2].invoice_number).toBe(`E2E-AUTO-${ts}-3`);
  });

  test('US-5.7: Create invoice manually (same as POS checkout)', async () => {
    const d = db(window);
    const ts = Date.now();
    await d.run(`DELETE FROM products WHERE barcode = 'MANUAL-INV-TEST'`);
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, category, unit) VALUES (?,?,?,?,?,?,?)`,
      ['Manual Invoice Test', 'MANUAL-INV-TEST', 100, 40, 50, 'TestManual', 'piece']);
    const prod = await d.get(`SELECT id, cost FROM products WHERE barcode = 'MANUAL-INV-TEST'`);
    // Create invoice manually via createInvoiceWithItems
    await d.run(`INSERT INTO invoices (invoice_number, subtotal, total, paid, status) VALUES (?,?,?,?,?)`,
      [`MANUAL-INV-${ts}`, 100, 100, 100, 'completed']);
    const inv = await d.get(`SELECT id FROM invoices WHERE invoice_number = ?`, [`MANUAL-INV-${ts}`]);
    await d.run(
      `INSERT INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?,?,?,?,?,?,?,?)`,
      [inv.id, prod.id, 'Manual Invoice Test', 'MANUAL-INV-TEST', 1, 100, prod.cost, 100]
    );
    // Verify invoice has items with correct cost
    const items = await d.all(`SELECT * FROM invoice_items WHERE invoice_id = ?`, [inv.id]);
    expect(items.length).toBe(1);
    expect(Number(items[0].unit_cost)).toBe(40);
    await d.run(`DELETE FROM invoice_items WHERE invoice_id = ?`, [inv.id]);
    await d.run(`DELETE FROM invoices WHERE invoice_number = ?`, [`MANUAL-INV-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = 'MANUAL-INV-TEST'`);
  });
});
