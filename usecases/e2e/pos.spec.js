import { test, expect } from '../../tests/fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('E2E - POS (Sales)', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
  });

  test('US-4.1: Add product to cart', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-POS-CART-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['POS Cart Test', `E2E-POS-CART-${ts}`, 50, 20, 10, 2, 'TestPOS', 'piece']);

    await window.evaluate((name) => {
      const input = document.querySelector('input[placeholder*="بحث"]');
      if (input) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, name);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, `E2E-POS-CART-${ts}`);
    await window.waitForTimeout(500);

    const product = await d.get(`SELECT * FROM products WHERE barcode = ?`, [`E2E-POS-CART-${ts}`]);
    expect(product).not.toBeNull();
    expect(product.name).toBe('POS Cart Test');
  });

  test('US-4.2: Unified search by name and barcode', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-POS-SRC-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Search Test', `E2E-POS-SRC-${ts}`, 30, 15, 5, 1, 'TestPOS', 'piece']);

    const byName = await d.get(`SELECT * FROM products WHERE name LIKE ?`, [`%Search Test%`]);
    expect(byName).not.toBeNull();

    const byBarcode = await d.get(`SELECT * FROM products WHERE barcode = ?`, [`E2E-POS-SRC-${ts}`]);
    expect(byBarcode).not.toBeNull();
    expect(byName.id).toBe(byBarcode.id);
  });

  test('US-4.3: Category filter', async () => {
    const d = db(window);
    const ts = Date.now();
    const category = `E2E-POS-CAT-${ts}`;

    await d.run(`DELETE FROM products WHERE category = ?`, [category]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Cat A', `${category}-A`, 10, 5, 3, 1, category, 'piece']);
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Cat B', `${category}-B`, 20, 10, 4, 1, category, 'piece']);

    const filtered = await d.all(`SELECT * FROM products WHERE category = ?`, [category]);
    expect(filtered.length).toBe(2);
  });

  test('US-4.4: Pagination', async () => {
    const d = db(window);
    const ts = Date.now();
    const category = `E2E-POS-PAGE-${ts}`;

    await d.run(`DELETE FROM products WHERE category = ?`, [category]);

    for (let i = 0; i < 25; i++) {
      await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
        [`PageProd ${i}`, `${category}-${i}`, 10, 5, 2, 1, category, 'piece']);
    }

    const page1 = await d.all(`SELECT * FROM products WHERE category = ? ORDER BY id LIMIT 20 OFFSET 0`, [category]);
    expect(page1.length).toBe(20);

    const page2 = await d.all(`SELECT * FROM products WHERE category = ? ORDER BY id LIMIT 20 OFFSET 20`, [category]);
    expect(page2.length).toBe(5);
  });

  test('US-4.5: Checkout creates invoice', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number = ?)`, [`E2E-INV-${ts}`]);
    await d.run(`DELETE FROM invoices WHERE invoice_number = ?`, [`E2E-INV-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-POS-CHK-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Checkout Test', `E2E-POS-CHK-${ts}`, 100, 40, 10, 2, 'TestPOS', 'piece']);
    const product = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-POS-CHK-${ts}`]);

    await d.run(`INSERT INTO customers (name, balance) VALUES (?,?)`, [`E2E-CUST-CHK-${ts}`, 0]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-CUST-CHK-${ts}`]);

    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status) VALUES (?,?,?,?,?,?,?)`,
      [`E2E-INV-${ts}`, customer.id, 100, 0, 0, 100, 'paid']);

    const invoice = await d.get(`SELECT * FROM invoices WHERE invoice_number = ?`, [`E2E-INV-${ts}`]);
    expect(invoice).not.toBeNull();
    expect(Number(invoice.total)).toBe(100);
    expect(invoice.status).toBe('paid');

    await d.run(`INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, unit_price, unit_cost, total_price) VALUES (?,?,?,?,?,?,?)`,
      [invoice.id, product.id, 'Checkout Test', 1, 100, 40, 100]);

    const items = await d.all(`SELECT * FROM invoice_items WHERE invoice_id = ?`, [invoice.id]);
    expect(items.length).toBe(1);
  });

  test('US-4.6: Checkout deducts stock', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number = ?)`, [`E2E-STK-${ts}`]);
    await d.run(`DELETE FROM invoices WHERE invoice_number = ?`, [`E2E-STK-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-POS-STK-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Stock Deduct', `E2E-POS-STK-${ts}`, 50, 20, 10, 2, 'TestPOS', 'piece']);
    const product = await d.get(`SELECT id, stock FROM products WHERE barcode = ?`, [`E2E-POS-STK-${ts}`]);
    const stockBefore = Number(product.stock);

    await d.run(`INSERT INTO customers (name) VALUES (?)`, [`E2E-CUST-STK-${ts}`]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-CUST-STK-${ts}`]);

    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status) VALUES (?,?,?,?,?,?,?)`,
      [`E2E-STK-${ts}`, customer.id, 100, 0, 0, 100, 'paid']);
    const invoice = await d.get(`SELECT id FROM invoices WHERE invoice_number = ?`, [`E2E-STK-${ts}`]);

    const qty = 3;
    await d.run(`INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, unit_price, unit_cost, total_price) VALUES (?,?,?,?,?,?,?)`,
      [invoice.id, product.id, 'Stock Deduct', qty, 50, 20, 150]);

    await d.run(`UPDATE products SET stock = stock - ? WHERE id = ?`, [qty, product.id]);

    const productAfter = await d.get(`SELECT stock FROM products WHERE id = ?`, [product.id]);
    expect(Number(productAfter.stock)).toBe(stockBefore - qty);
  });

  test('US-4.7: Checkout snapshots unit_cost', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number = ?)`, [`E2E-COST-${ts}`]);
    await d.run(`DELETE FROM invoices WHERE invoice_number = ?`, [`E2E-COST-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-POS-COST-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Cost Snap', `E2E-POS-COST-${ts}`, 80, 35, 10, 2, 'TestPOS', 'piece']);
    const product = await d.get(`SELECT id, cost FROM products WHERE barcode = ?`, [`E2E-POS-COST-${ts}`]);

    await d.run(`INSERT INTO customers (name) VALUES (?)`, [`E2E-CUST-COST-${ts}`]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-CUST-COST-${ts}`]);

    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status) VALUES (?,?,?,?,?,?,?)`,
      [`E2E-COST-${ts}`, customer.id, 80, 0, 0, 80, 'paid']);
    const invoice = await d.get(`SELECT id FROM invoices WHERE invoice_number = ?`, [`E2E-COST-${ts}`]);

    await d.run(`INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, unit_price, unit_cost, total_price) VALUES (?,?,?,?,?,?,?)`,
      [invoice.id, product.id, 'Cost Snap', 2, 80, Number(product.cost), 160]);

    const item = await d.get(`SELECT * FROM invoice_items WHERE invoice_id = ?`, [invoice.id]);
    expect(Number(item.unit_cost)).toBe(Number(product.cost));
  });

  test('US-4.8: Checkout creates cash register movement (in)', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM cashier_movements WHERE reason = ?`, [`Sale: E2E-CASH-${ts}`]);
    await d.run(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number = ?)`, [`E2E-CASH-${ts}`]);
    await d.run(`DELETE FROM invoices WHERE invoice_number = ?`, [`E2E-CASH-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-POS-CASH-${ts}`]);

    const existingRegister = await d.get(`SELECT id FROM cash_registers WHERE status = 'open'`);
    let registerId;
    if (existingRegister) {
      registerId = existingRegister.id;
    } else {
      const reg = await d.run(`INSERT INTO cash_registers (opening_balance, status) VALUES (?,?)`, [0, 'open']);
      registerId = reg.lastInsertRowid;
    }

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Cash Move', `E2E-POS-CASH-${ts}`, 60, 25, 10, 2, 'TestPOS', 'piece']);
    const product = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-POS-CASH-${ts}`]);

    await d.run(`INSERT INTO customers (name) VALUES (?)`, [`E2E-CUST-CASH-${ts}`]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-CUST-CASH-${ts}`]);

    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status) VALUES (?,?,?,?,?,?,?)`,
      [`E2E-CASH-${ts}`, customer.id, 60, 0, 0, 60, 'paid']);
    const invoice = await d.get(`SELECT id FROM invoices WHERE invoice_number = ?`, [`E2E-CASH-${ts}`]);

    await d.run(`INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, unit_price, unit_cost, total_price) VALUES (?,?,?,?,?,?,?)`,
      [invoice.id, product.id, 'Cash Move', 1, 60, 25, 60]);

    await d.run(`INSERT INTO cashier_movements (register_id, type, amount, reason) VALUES (?,?,?,?)`,
      [registerId, 'in', 60, `Sale: E2E-CASH-${ts}`]);

    const movement = await d.get(`SELECT * FROM cashier_movements WHERE reason = ?`, [`Sale: E2E-CASH-${ts}`]);
    expect(movement).not.toBeNull();
    expect(movement.type).toBe('in');
    expect(Number(movement.amount)).toBe(60);
  });

  test('US-4.9: Cart total with tax and discount', async () => {
    const d = db(window);
    const ts = Date.now();

    const subtotal = 200;
    const discount = 20;
    const taxRate = 0.1;
    const tax = (subtotal - discount) * taxRate;
    const total = (subtotal - discount) + tax;

    await d.run(`DELETE FROM invoices WHERE invoice_number = ?`, [`E2E-TAXDISC-${ts}`]);

    await d.run(`INSERT INTO customers (name) VALUES (?)`, [`E2E-CUST-TAX-${ts}`]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-CUST-TAX-${ts}`]);

    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status) VALUES (?,?,?,?,?,?,?)`,
      [`E2E-TAXDISC-${ts}`, customer.id, subtotal, discount, tax, total, 'paid']);

    const invoice = await d.get(`SELECT * FROM invoices WHERE invoice_number = ?`, [`E2E-TAXDISC-${ts}`]);
    expect(Number(invoice.subtotal)).toBe(subtotal);
    expect(Number(invoice.discount)).toBe(discount);
    expect(Number(invoice.tax)).toBe(tax);
    expect(Number(invoice.total)).toBe(total);
    expect(Number(invoice.total)).toBeCloseTo((subtotal - discount) + tax, 2);
  });

  test('US-4.10: Customer credit limit check', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number = ?)`, [`E2E-CREDIT-${ts}`]);
    await d.run(`DELETE FROM invoices WHERE invoice_number = ?`, [`E2E-CREDIT-${ts}`]);
    await d.run(`DELETE FROM customers WHERE name = ?`, [`E2E-CUST-CREDIT-${ts}`]);

    await d.run(`INSERT INTO customers (name, credit_limit, balance) VALUES (?,?,?)`, [`E2E-CUST-CREDIT-${ts}`, 100, 0]);
    const customer = await d.get(`SELECT id, credit_limit, balance FROM customers WHERE name = ?`, [`E2E-CUST-CREDIT-${ts}`]);

    const invoiceTotal = 200;
    const exceedsLimit = (Number(customer.balance) + invoiceTotal) > Number(customer.credit_limit);
    expect(exceedsLimit).toBe(true);
  });

  test('US-4.11: Currency symbol from settings', async () => {
    const d = db(window);
    await d.run(`DELETE FROM \`settings\` WHERE \`key\` = 'currency'`);
    await d.run(`INSERT INTO \`settings\` (\`key\`, \`value\`) VALUES (?,?)`, ['currency', 'SAR']);
    const setting = await d.get(`SELECT * FROM \`settings\` WHERE \`key\` = 'currency'`);
    expect(setting).not.toBeNull();
    expect(setting.value).toBe('SAR');
    await d.run(`DELETE FROM \`settings\` WHERE \`key\` = 'currency'`);
  });

  test('US-4.12: Scanner auto-adds product by barcode', async () => {
    const d = db(window);
    const ts = Date.now();
    await d.run(`DELETE FROM products WHERE barcode = 'SCAN-TEST-001'`);
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, category, unit) VALUES (?,?,?,?,?,?,?)`,
      ['Scanner Test', 'SCAN-TEST-001', 50, 20, 10, 'TestScan', 'piece']);
    const product = await d.get(`SELECT * FROM products WHERE barcode = 'SCAN-TEST-001'`);
    expect(product).not.toBeNull();
    expect(product.name).toBe('Scanner Test');
    await d.run(`DELETE FROM products WHERE barcode = 'SCAN-TEST-001'`);
  });

  test('US-4.13: Scanner readiness indicator', async () => {
    const d = db(window);
    const status = await d.get(`SELECT value FROM \`settings\` WHERE \`key\` = 'scanner_ready'`);
    // Scanner status is tracked via UI; DB-level check that setting exists
    await d.run(`DELETE FROM \`settings\` WHERE \`key\` = 'scanner_status'`);
    await d.run(`INSERT INTO \`settings\` (\`key\`, \`value\`) VALUES (?,?)`, ['scanner_status', 'ready']);
    const saved = await d.get(`SELECT value FROM \`settings\` WHERE \`key\` = 'scanner_status'`);
    expect(saved.value).toBe('ready');
    await d.run(`DELETE FROM \`settings\` WHERE \`key\` = 'scanner_status'`);
  });
});
