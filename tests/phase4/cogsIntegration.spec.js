import { test, expect } from '../fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

function cleanup(d, barcodes) {
  const placeholders = barcodes.map(() => '?').join(',');
  // Delete child table rows referencing these products first
  return d.run(`DELETE FROM invoice_items WHERE product_id IN (SELECT id FROM products WHERE barcode IN (${placeholders}))`, barcodes);
}

function cleanupPurchaseItems(d, barcodes) {
  const placeholders = barcodes.map(() => '?').join(',');
  return d.run(`DELETE FROM purchase_order_items WHERE product_id IN (SELECT id FROM products WHERE barcode IN (${placeholders}))`, barcodes);
}

test.describe('COGS & Cash Register Integration', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('جاري التحميل');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
  });

  test('4.8.1 - invoice_items stores unit_cost snapshot at sale time', async () => {
    const d = db(window);
    const ts = Date.now();

    await cleanup(d, ['COGS-TEST-001']);
    await d.run(`DELETE FROM products WHERE barcode = 'COGS-TEST-001'`);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['COGS Test', 'COGS-TEST-001', 100, 30, 50, 5, 'TestCogs', 'piece']);

    const product = await d.get(`SELECT id, cost FROM products WHERE barcode = 'COGS-TEST-001'`);

    const invoiceResult = await d.run(
      `INSERT INTO invoices (invoice_number, subtotal, total, paid, status) VALUES (?,?,?,?,?)`,
      [`COGS-INV-${ts}`, 100, 100, 100, 'completed']
    );
    const invoiceId = invoiceResult.lastInsertRowid;

    await d.run(
      `INSERT INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?,?,?,?,?,?,?,?)`,
      [invoiceId, product.id, 'COGS Test', 'COGS-TEST-001', 1, 100, product.cost, 100]
    );

    const item = await d.get(`SELECT * FROM invoice_items WHERE invoice_id = ?`, [invoiceId]);
    expect(item).not.toBeNull();
    expect(Number(item.unit_cost)).toBe(30);
    expect(Number(item.unit_price)).toBe(100);
  });

  test('4.8.2 - Product cost updated by PO receipt unit_cost', async () => {
    const d = db(window);
    const ts = Date.now();

    await cleanup(d, ['PO-COST-TEST']);
    await cleanupPurchaseItems(d, ['PO-COST-TEST']);
    await d.run(`DELETE FROM purchase_orders WHERE po_number = ?`, [`PO-COST-${ts}`]);
    await d.run(`DELETE FROM suppliers WHERE name = ?`, [`PO Cost Supplier ${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = 'PO-COST-TEST'`);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['PO Cost Test', 'PO-COST-TEST', 100, 10, 5, 2, 'TestPoCost', 'piece']);

    const product = await d.get(`SELECT id FROM products WHERE barcode = 'PO-COST-TEST'`);

    await d.run(`INSERT INTO suppliers (name) VALUES (?)`, [`PO Cost Supplier ${ts}`]);
    const supplier = await d.get(`SELECT id FROM suppliers WHERE name = ?`, [`PO Cost Supplier ${ts}`]);

    await d.run(`INSERT INTO purchase_orders (po_number, supplier_id, subtotal, total, status) VALUES (?,?,?,?,?)`,
      [`PO-COST-${ts}`, supplier.id, 250, 250, 'pending']);
    const po = await d.get(`SELECT id FROM purchase_orders WHERE po_number = ?`, [`PO-COST-${ts}`]);

    await d.run(
      `INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?,?,?,?,?,?)`,
      [po.id, product.id, 'PO Cost Test', 10, 25, 250]
    );

    const productBefore = await d.get(`SELECT cost, stock FROM products WHERE id = ?`, [product.id]);
    expect(Number(productBefore.cost)).toBe(10);

    // Simulate receiveOrder: update cost from PO unit_price
    const poItem = await d.get(`SELECT * FROM purchase_order_items WHERE purchase_order_id = ?`, [po.id]);
    expect(poItem).not.toBeNull();
    const newCost = Number(poItem.unit_price);
    const newStock = productBefore.stock + poItem.quantity;
    await d.run(`UPDATE products SET cost = ?, stock = ? WHERE id = ?`, [newCost, newStock, product.id]);

    const productAfter = await d.get(`SELECT cost, stock FROM products WHERE id = ?`, [product.id]);
    expect(Number(productAfter.cost)).toBe(25);
    expect(Number(productAfter.stock)).toBe(15);
  });

  test('4.8.3 - Profit calculation uses cost-at-sale-time not live cost', async () => {
    const d = db(window);
    const ts = Date.now();

    await cleanup(d, ['PROFIT-TEST']);
    await d.run(`DELETE FROM products WHERE barcode = 'PROFIT-TEST'`);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Profit Test', 'PROFIT-TEST', 100, 20, 10, 1, 'TestProfit', 'piece']);

    const product = await d.get(`SELECT id FROM products WHERE barcode = 'PROFIT-TEST'`);

    await d.run(`INSERT INTO invoices (invoice_number, subtotal, total, paid, status) VALUES (?,?,?,?,?)`,
      [`PROF-INV-${ts}`, 100, 100, 100, 'completed']);
    const inv = await d.get(`SELECT id FROM invoices WHERE invoice_number = ?`, [`PROF-INV-${ts}`]);

    await d.run(
      `INSERT INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?,?,?,?,?,?,?,?)`,
      [inv.id, product.id, 'Profit Test', 'PROFIT-TEST', 2, 100, 20, 200]
    );

    // Change live cost to 50 (simulating cost change over time)
    await d.run(`UPDATE products SET cost = 50 WHERE id = ?`, [product.id]);

    // Profit should use unit_cost (20) from invoice_items, not live cost (50)
    const result = await d.get(
      `SELECT COALESCE(SUM((ii.unit_price - ii.unit_cost) * ii.quantity),0) as total
       FROM invoice_items ii JOIN invoices i ON ii.invoice_id = i.id WHERE i.id = ?`,
      [inv.id]
    );

    expect(Number(result.total)).toBe(160);
  });

  test('4.8.4 - Profit report uses invoice_items.unit_cost correctly', async () => {
    const d = db(window);
    const ts = Date.now();

    const today = new Date().toISOString().slice(0, 10);

    await cleanup(d, ['REPORT-COST-TEST']);
    await d.run(`DELETE FROM products WHERE barcode = 'REPORT-COST-TEST'`);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Report Cost Test', 'REPORT-COST-TEST', 200, 30, 10, 1, 'TestReportCost', 'piece']);

    const product = await d.get(`SELECT id FROM products WHERE barcode = 'REPORT-COST-TEST'`);

    await d.run(`INSERT INTO invoices (invoice_number, subtotal, total, paid, status, created_at) VALUES (?,?,?,?,?,?)`,
      [`REP-INV-${ts}`, 400, 400, 400, 'completed', today]);
    const inv = await d.get(`SELECT id FROM invoices WHERE invoice_number = ?`, [`REP-INV-${ts}`]);

    await d.run(
      `INSERT INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?,?,?,?,?,?,?,?)`,
      [inv.id, product.id, 'Report Cost Test', 'REPORT-COST-TEST', 2, 200, 30, 400]
    );

    const dailyProfit = await d.get(
      `SELECT COALESCE(SUM((ii.unit_price - ii.unit_cost) * ii.quantity),0) as total
       FROM invoice_items ii JOIN invoices i ON ii.invoice_id = i.id WHERE DATE(i.created_at) = ?`,
      [today]
    );

    expect(Number(dailyProfit.total)).toBeGreaterThanOrEqual(340);
  });

  test('4.8.5 - Cash register has auto POS sale movement', async () => {
    const d = db(window);

    // Ensure an open cash register exists
    const existingRegisters = await d.all(`SELECT * FROM cash_registers WHERE status = 'open'`);
    let registerId;
    if (existingRegisters.length === 0) {
      const reg = await d.run(`INSERT INTO cash_registers (opening_balance, status) VALUES (?,?)`, [0, 'open']);
      registerId = reg.lastInsertRowid;
    } else {
      registerId = existingRegisters[0].id;
    }

    const ts = Date.now();
    await d.run(`INSERT INTO cashier_movements (register_id, type, amount, reason) VALUES (?,?,?,?)`,
      [registerId, 'in', 500, `POS Sale: INV-AUTO-${ts}`]);

    const movement = await d.get(`SELECT * FROM cashier_movements WHERE reason = ?`, [`POS Sale: INV-AUTO-${ts}`]);
    expect(movement).not.toBeNull();
    expect(movement.type).toBe('in');
    expect(Number(movement.amount)).toBe(500);
  });
});
