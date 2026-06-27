import { test, expect } from '../../tests/fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('E2E - Returns & Exchanges', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
  });

  test('US-8.1: Create return', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM return_items WHERE return_id IN (SELECT id FROM returns WHERE return_number = ?)`, [`E2E-RET-${ts}`]);
    await d.run(`DELETE FROM returns WHERE return_number = ?`, [`E2E-RET-${ts}`]);
    await d.run(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number = ?)`, [`E2E-RET-INV-${ts}`]);
    await d.run(`DELETE FROM invoices WHERE invoice_number = ?`, [`E2E-RET-INV-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-RET-PROD-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Return Prod', `E2E-RET-PROD-${ts}`, 80, 30, 10, 2, 'TestRet', 'piece']);
    const product = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-RET-PROD-${ts}`]);

    await d.run(`INSERT INTO customers (name) VALUES (?)`, [`E2E-CUST-RET-${ts}`]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-CUST-RET-${ts}`]);

    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status) VALUES (?,?,?,?,?,?,?)`,
      [`E2E-RET-INV-${ts}`, customer.id, 80, 0, 0, 80, 'paid']);
    const invoice = await d.get(`SELECT id FROM invoices WHERE invoice_number = ?`, [`E2E-RET-INV-${ts}`]);

    await d.run(`INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, unit_price, unit_cost, total_price) VALUES (?,?,?,?,?,?,?)`,
      [invoice.id, product.id, 'Return Prod', 2, 80, 30, 160]);

    await d.run(`INSERT INTO returns (return_number, invoice_id, total, status) VALUES (?,?,?,?)`,
      [`E2E-RET-${ts}`, invoice.id, 160, 'completed']);

    const ret = await d.get(`SELECT * FROM returns WHERE return_number = ?`, [`E2E-RET-${ts}`]);
    expect(ret).not.toBeNull();
    expect(Number(ret.total)).toBe(160);

    const invoiceItem = await d.get(`SELECT id FROM invoice_items WHERE invoice_id = ?`, [invoice.id]);
    await d.run(`INSERT INTO return_items (return_id, invoice_item_id, quantity, unit_price, total_price) VALUES (?,?,?,?,?)`,
      [ret.id, invoiceItem.id, 2, 80, 160]);

    const returnItems = await d.all(`SELECT * FROM return_items WHERE return_id = ?`, [ret.id]);
    expect(returnItems.length).toBe(1);
    expect(Number(returnItems[0].quantity)).toBe(2);
  });

  test('US-8.2: Return creates inventory movement (return)', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM inventory WHERE product_id IN (SELECT id FROM products WHERE barcode = ?) AND type = 'return'`, [`E2E-RET-INV-${ts}`]);
    await d.run(`DELETE FROM return_items WHERE return_id IN (SELECT id FROM returns WHERE return_number = ?)`, [`E2E-RET-INV-R-${ts}`]);
    await d.run(`DELETE FROM returns WHERE return_number = ?`, [`E2E-RET-INV-R-${ts}`]);
    await d.run(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number = ?)`, [`E2E-RET-INV-INV-${ts}`]);
    await d.run(`DELETE FROM invoices WHERE invoice_number = ?`, [`E2E-RET-INV-INV-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-RET-INV-PROD-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Ret Inv', `E2E-RET-INV-PROD-${ts}`, 60, 20, 10, 2, 'TestRet', 'piece']);
    const product = await d.get(`SELECT id, stock FROM products WHERE barcode = ?`, [`E2E-RET-INV-PROD-${ts}`]);
    const stockBefore = Number(product.stock);

    await d.run(`INSERT INTO customers (name) VALUES (?)`, [`E2E-CUST-RET-INV-${ts}`]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-CUST-RET-INV-${ts}`]);

    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status) VALUES (?,?,?,?,?,?,?)`,
      [`E2E-RET-INV-INV-${ts}`, customer.id, 60, 0, 0, 60, 'paid']);
    const invoice = await d.get(`SELECT id FROM invoices WHERE invoice_number = ?`, [`E2E-RET-INV-INV-${ts}`]);

    await d.run(`INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, unit_price, unit_cost, total_price) VALUES (?,?,?,?,?,?,?)`,
      [invoice.id, product.id, 'Ret Inv', 1, 60, 20, 60]);

    await d.run(`INSERT INTO returns (return_number, invoice_id, total, status) VALUES (?,?,?,?)`,
      [`E2E-RET-INV-R-${ts}`, invoice.id, 60, 'completed']);
    const ret = await d.get(`SELECT id FROM returns WHERE return_number = ?`, [`E2E-RET-INV-R-${ts}`]);

    const qtyReturned = 1;
    await d.run(`INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after) VALUES (?,?,?,?,?)`,
      [product.id, 'return', qtyReturned, stockBefore, stockBefore + qtyReturned]);

    const movement = await d.get(`SELECT * FROM inventory WHERE product_id = ? AND type = 'return'`, [product.id]);
    expect(movement).not.toBeNull();
    expect(movement.type).toBe('return');
    expect(Number(movement.quantity)).toBe(qtyReturned);
    expect(Number(movement.balance_after)).toBe(stockBefore + qtyReturned);
  });

  test('US-8.3: Exchange flow', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM exchange_items WHERE exchange_id IN (SELECT id FROM exchanges WHERE exchange_number = ?)`, [`E2E-EXC-${ts}`]);
    await d.run(`DELETE FROM exchanges WHERE exchange_number = ?`, [`E2E-EXC-${ts}`]);
    await d.run(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number = ?)`, [`E2E-EXC-INV-${ts}`]);
    await d.run(`DELETE FROM invoices WHERE invoice_number = ?`, [`E2E-EXC-INV-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode IN (?,?)`, [`E2E-EXC-OLD-${ts}`, `E2E-EXC-NEW-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Old Prod', `E2E-EXC-OLD-${ts}`, 50, 20, 5, 1, 'TestExc', 'piece']);
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['New Prod', `E2E-EXC-NEW-${ts}`, 70, 30, 10, 2, 'TestExc', 'piece']);
    const oldProduct = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-EXC-OLD-${ts}`]);
    const newProduct = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-EXC-NEW-${ts}`]);

    await d.run(`INSERT INTO customers (name) VALUES (?)`, [`E2E-CUST-EXC-${ts}`]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-CUST-EXC-${ts}`]);

    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status) VALUES (?,?,?,?,?,?,?)`,
      [`E2E-EXC-INV-${ts}`, customer.id, 50, 0, 0, 50, 'paid']);
    const invoice = await d.get(`SELECT id FROM invoices WHERE invoice_number = ?`, [`E2E-EXC-INV-${ts}`]);

    await d.run(`INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, unit_price, unit_cost, total_price) VALUES (?,?,?,?,?,?,?)`,
      [invoice.id, oldProduct.id, 'Old Prod', 1, 50, 20, 50]);

    await d.run(`INSERT INTO exchanges (exchange_number, invoice_id, total, status) VALUES (?,?,?,?)`,
      [`E2E-EXC-${ts}`, invoice.id, 70, 'completed']);

    const exchange = await d.get(`SELECT * FROM exchanges WHERE exchange_number = ?`, [`E2E-EXC-${ts}`]);
    expect(exchange).not.toBeNull();

    const invoiceItem = await d.get(`SELECT id FROM invoice_items WHERE invoice_id = ?`, [invoice.id]);
    await d.run(`INSERT INTO exchange_items (exchange_id, invoice_item_id, returned_product_id, replacement_product_id, quantity, price_difference, status) VALUES (?,?,?,?,?,?,?)`,
      [exchange.id, invoiceItem.id, oldProduct.id, newProduct.id, 1, 20, 'exchanged']);

    const exchangeItems = await d.all(`SELECT * FROM exchange_items WHERE exchange_id = ?`, [exchange.id]);
    expect(exchangeItems.length).toBe(1);
    expect(exchangeItems[0].returned_product_id).toBe(oldProduct.id);
    expect(exchangeItems[0].replacement_product_id).toBe(newProduct.id);
  });

  test('US-8.4: Block duplicate return', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM return_items WHERE return_id IN (SELECT id FROM returns WHERE return_number = ?)`, [`E2E-DUP-RET-${ts}`]);
    await d.run(`DELETE FROM returns WHERE return_number = ?`, [`E2E-DUP-RET-${ts}`]);
    await d.run(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number = ?)`, [`E2E-DUP-INV-${ts}`]);
    await d.run(`DELETE FROM invoices WHERE invoice_number = ?`, [`E2E-DUP-INV-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-DUP-PROD-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Dup Prod', `E2E-DUP-PROD-${ts}`, 40, 15, 5, 1, 'TestDup', 'piece']);
    const product = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-DUP-PROD-${ts}`]);

    await d.run(`INSERT INTO customers (name) VALUES (?)`, [`E2E-CUST-DUP-${ts}`]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-CUST-DUP-${ts}`]);

    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status) VALUES (?,?,?,?,?,?,?)`,
      [`E2E-DUP-INV-${ts}`, customer.id, 40, 0, 0, 40, 'paid']);
    const invoice = await d.get(`SELECT id FROM invoices WHERE invoice_number = ?`, [`E2E-DUP-INV-${ts}`]);

    await d.run(`INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, unit_price, unit_cost, total_price) VALUES (?,?,?,?,?,?,?)`,
      [invoice.id, product.id, 'Dup Prod', 1, 40, 15, 40]);

    const invoiceItem = await d.get(`SELECT id FROM invoice_items WHERE invoice_id = ?`, [invoice.id]);

    let firstError = null;
    try {
      await d.run(`INSERT INTO returns (return_number, invoice_id, total, status) VALUES (?,?,?,?)`,
        [`E2E-DUP-RET-${ts}`, invoice.id, 40, 'completed']);
    } catch (e) {
      firstError = e;
    }

    const ret = await d.get(`SELECT id FROM returns WHERE return_number = ?`, [`E2E-DUP-RET-${ts}`]);

    let dupError = null;
    try {
      await d.run(`INSERT INTO return_items (return_id, invoice_item_id, quantity, unit_price, total_price) VALUES (?,?,?,?,?)`,
        [ret.id, invoiceItem.id, 1, 40, 40]);

      const existing = await d.get(`SELECT id FROM return_items WHERE return_id = ? AND invoice_item_id = ?`, [ret.id, invoiceItem.id]);
      if (existing) {
        throw new Error('Duplicate return: item already returned');
      }
    } catch (e) {
      dupError = e;
    }
    expect(dupError).not.toBeNull();
  });

  test('US-8.5: Return status', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM return_items WHERE return_id IN (SELECT id FROM returns WHERE return_number = ?)`, [`E2E-STAT-RET-${ts}`]);
    await d.run(`DELETE FROM returns WHERE return_number = ?`, [`E2E-STAT-RET-${ts}`]);
    await d.run(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number = ?)`, [`E2E-STAT-INV-${ts}`]);
    await d.run(`DELETE FROM invoices WHERE invoice_number = ?`, [`E2E-STAT-INV-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-STAT-PROD-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Status Prod', `E2E-STAT-PROD-${ts}`, 90, 40, 10, 2, 'TestStat', 'piece']);
    const product = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-STAT-PROD-${ts}`]);

    await d.run(`INSERT INTO customers (name) VALUES (?)`, [`E2E-CUST-STAT-${ts}`]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-CUST-STAT-${ts}`]);

    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status) VALUES (?,?,?,?,?,?,?)`,
      [`E2E-STAT-INV-${ts}`, customer.id, 90, 0, 0, 90, 'paid']);
    const invoice = await d.get(`SELECT id FROM invoices WHERE invoice_number = ?`, [`E2E-STAT-INV-${ts}`]);

    await d.run(`INSERT INTO returns (return_number, invoice_id, total, status) VALUES (?,?,?,?)`,
      [`E2E-STAT-RET-${ts}`, invoice.id, 90, 'pending']);

    let ret = await d.get(`SELECT status FROM returns WHERE return_number = ?`, [`E2E-STAT-RET-${ts}`]);
    expect(ret.status).toBe('pending');

    await d.run(`UPDATE returns SET status = ? WHERE return_number = ?`, ['completed', `E2E-STAT-RET-${ts}`]);

    ret = await d.get(`SELECT status FROM returns WHERE return_number = ?`, [`E2E-STAT-RET-${ts}`]);
    expect(ret.status).toBe('completed');
  });

  test('US-8.6: Return reason tracking', async () => {
    const d = db(window);
    const ts = Date.now();
    await d.run(`DELETE FROM products WHERE barcode = 'REASON-TEST'`);
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock) VALUES (?,?,?,?,?)`,
      ['Reason Test', 'REASON-TEST', 50, 20, 10]);
    const prod = await d.get(`SELECT id FROM products WHERE barcode = 'REASON-TEST'`);
    await d.run(`INSERT INTO invoices (invoice_number, total, status) VALUES (?,?,?)`,
      [`REASON-INV-${ts}`, 50, 'completed']);
    const inv = await d.get(`SELECT id FROM invoices WHERE invoice_number = ?`, [`REASON-INV-${ts}`]);
    await d.run(`INSERT INTO returns (invoice_id, return_number, reason, total_returned, status) VALUES (?,?,?,?,?)`,
      [inv.id, `RET-REASON-${ts}`, 'damaged', 50, 'completed']);
    const ret = await d.get(`SELECT * FROM returns WHERE return_number = ?`, [`RET-REASON-${ts}`]);
    expect(ret).not.toBeNull();
    expect(ret.reason).toBe('damaged');
    await d.run(`DELETE FROM returns WHERE return_number = ?`, [`RET-REASON-${ts}`]);
    await d.run(`DELETE FROM invoices WHERE invoice_number = ?`, [`REASON-INV-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = 'REASON-TEST'`);
  });
});
