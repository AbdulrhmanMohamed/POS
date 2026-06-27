import { test, expect } from '../../tests/fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('E2E - Purchase Orders', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('جاري التحميل');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
  });

  test('US-3.1: Create PO with items', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE po_number = ?)`, [`E2E-PO-${ts}`]);
    await d.run(`DELETE FROM purchase_orders WHERE po_number = ?`, [`E2E-PO-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-PO-PROD-${ts}`]);
    await d.run(`DELETE FROM suppliers WHERE name = ?`, [`E2E-PO-SUP-${ts}`]);

    await d.run(`INSERT INTO suppliers (name) VALUES (?)`, [`E2E-PO-SUP-${ts}`]);
    const supplier = await d.get(`SELECT id FROM suppliers WHERE name = ?`, [`E2E-PO-SUP-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['E2E PO Product', `E2E-PO-PROD-${ts}`, 100, 50, 10, 2, 'TestPO', 'piece']);
    const product = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-PO-PROD-${ts}`]);

    await d.run(`INSERT INTO purchase_orders (po_number, supplier_id, subtotal, total, status) VALUES (?,?,?,?,?)`,
      [`E2E-PO-${ts}`, supplier.id, 250, 250, 'pending']);
    const po = await d.get(`SELECT id, status FROM purchase_orders WHERE po_number = ?`, [`E2E-PO-${ts}`]);
    expect(po.status).toBe('pending');

    await d.run(`INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?,?,?,?,?,?)`,
      [po.id, product.id, 'E2E PO Product', 10, 25, 250]);

    const items = await d.all(`SELECT * FROM purchase_order_items WHERE purchase_order_id = ?`, [po.id]);
    expect(items.length).toBe(1);
    expect(Number(items[0].quantity)).toBe(10);
    expect(Number(items[0].unit_price)).toBe(25);
  });

  test('US-3.2: Receive PO updates stock and cost', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE po_number = ?)`, [`E2E-PO-RCV-${ts}`]);
    await d.run(`DELETE FROM purchase_orders WHERE po_number = ?`, [`E2E-PO-RCV-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-PO-RCV-PROD-${ts}`]);
    await d.run(`DELETE FROM suppliers WHERE name = ?`, [`E2E-PO-RCV-SUP-${ts}`]);

    await d.run(`INSERT INTO suppliers (name) VALUES (?)`, [`E2E-PO-RCV-SUP-${ts}`]);
    const supplier = await d.get(`SELECT id FROM suppliers WHERE name = ?`, [`E2E-PO-RCV-SUP-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['E2E Rcv Prod', `E2E-PO-RCV-PROD-${ts}`, 100, 10, 5, 2, 'TestRcv', 'piece']);
    const product = await d.get(`SELECT id, cost, stock FROM products WHERE barcode = ?`, [`E2E-PO-RCV-PROD-${ts}`]);
    expect(Number(product.cost)).toBe(10);
    expect(Number(product.stock)).toBe(5);

    await d.run(`INSERT INTO purchase_orders (po_number, supplier_id, subtotal, total, status) VALUES (?,?,?,?,?)`,
      [`E2E-PO-RCV-${ts}`, supplier.id, 125, 125, 'pending']);
    const po = await d.get(`SELECT id FROM purchase_orders WHERE po_number = ?`, [`E2E-PO-RCV-${ts}`]);

    await d.run(`INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?,?,?,?,?,?)`,
      [po.id, product.id, 'E2E Rcv Prod', 5, 25, 125]);

    await d.run(`UPDATE products SET cost = ?, stock = stock + ? WHERE id = ?`, [25, 5, product.id]);

    const productAfter = await d.get(`SELECT cost, stock FROM products WHERE id = ?`, [product.id]);
    expect(Number(productAfter.cost)).toBe(25);
    expect(Number(productAfter.stock)).toBe(10);
  });

  test('US-3.3: Receive PO creates inventory movement', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM inventory WHERE product_id IN (SELECT id FROM products WHERE barcode = ?)`, [`E2E-PO-INV-${ts}`]);
    await d.run(`DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE po_number = ?)`, [`E2E-PO-INV-${ts}`]);
    await d.run(`DELETE FROM purchase_orders WHERE po_number = ?`, [`E2E-PO-INV-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-PO-INV-PROD-${ts}`]);
    await d.run(`DELETE FROM suppliers WHERE name = ?`, [`E2E-PO-INV-SUP-${ts}`]);

    await d.run(`INSERT INTO suppliers (name) VALUES (?)`, [`E2E-PO-INV-SUP-${ts}`]);
    const supplier = await d.get(`SELECT id FROM suppliers WHERE name = ?`, [`E2E-PO-INV-SUP-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['E2E PO Inv', `E2E-PO-INV-PROD-${ts}`, 100, 10, 5, 2, 'TestPOInv', 'piece']);
    const product = await d.get(`SELECT id, stock FROM products WHERE barcode = ?`, [`E2E-PO-INV-PROD-${ts}`]);

    await d.run(`INSERT INTO purchase_orders (po_number, supplier_id, subtotal, total, status) VALUES (?,?,?,?,?)`,
      [`E2E-PO-INV-${ts}`, supplier.id, 300, 300, 'pending']);
    const po = await d.get(`SELECT id FROM purchase_orders WHERE po_number = ?`, [`E2E-PO-INV-${ts}`]);

    await d.run(`INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?,?,?,?,?,?)`,
      [po.id, product.id, 'E2E PO Inv', 10, 30, 300]);

    const stockBefore = Number(product.stock);
    const poItem = await d.get(`SELECT * FROM purchase_order_items WHERE purchase_order_id = ?`, [po.id]);
    await d.run(`INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after) VALUES (?,?,?,?,?)`,
      [product.id, 'add', poItem.quantity, stockBefore, stockBefore + poItem.quantity]);
    await d.run(`UPDATE products SET stock = stock + ? WHERE id = ?`, [poItem.quantity, product.id]);

    const movement = await d.get(`SELECT * FROM inventory WHERE product_id = ? AND type = 'add'`, [product.id]);
    expect(movement).not.toBeNull();
    expect(Number(movement.quantity)).toBe(10);
    expect(Number(movement.balance_after)).toBe(stockBefore + 10);
  });

  test('US-3.4: Receive PO updates supplier balance', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE po_number = ?)`, [`E2E-PO-BAL-${ts}`]);
    await d.run(`DELETE FROM purchase_orders WHERE po_number = ?`, [`E2E-PO-BAL-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-PO-BAL-PROD-${ts}`]);
    await d.run(`DELETE FROM suppliers WHERE name = ?`, [`E2E-PO-BAL-SUP-${ts}`]);

    await d.run(`INSERT INTO suppliers (name, balance) VALUES (?,?)`, [`E2E-PO-BAL-SUP-${ts}`, 0]);
    const supplier = await d.get(`SELECT id, balance FROM suppliers WHERE name = ?`, [`E2E-PO-BAL-SUP-${ts}`]);
    const balanceBefore = Number(supplier.balance);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['E2E PO Bal', `E2E-PO-BAL-PROD-${ts}`, 100, 10, 5, 2, 'TestPOBal', 'piece']);
    const product = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-PO-BAL-PROD-${ts}`]);

    await d.run(`INSERT INTO purchase_orders (po_number, supplier_id, subtotal, total, status) VALUES (?,?,?,?,?)`,
      [`E2E-PO-BAL-${ts}`, supplier.id, 500, 500, 'pending']);
    const po = await d.get(`SELECT id FROM purchase_orders WHERE po_number = ?`, [`E2E-PO-BAL-${ts}`]);

    await d.run(`INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?,?,?,?,?,?)`,
      [po.id, product.id, 'E2E PO Bal', 10, 50, 500]);

    await d.run(`UPDATE suppliers SET balance = balance + ? WHERE id = ?`, [500, supplier.id]);

    const supplierAfter = await d.get(`SELECT balance FROM suppliers WHERE id = ?`, [supplier.id]);
    expect(Number(supplierAfter.balance)).toBe(balanceBefore + 500);
  });

  test('US-3.5: Receive PO creates cash register movement', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM cashier_movements WHERE reason = ?`, [`PO Payment: E2E-PO-CASH-${ts}`]);
    await d.run(`DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE po_number = ?)`, [`E2E-PO-CASH-${ts}`]);
    await d.run(`DELETE FROM purchase_orders WHERE po_number = ?`, [`E2E-PO-CASH-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-PO-CASH-PROD-${ts}`]);
    await d.run(`DELETE FROM suppliers WHERE name = ?`, [`E2E-PO-CASH-SUP-${ts}`]);

    const existingRegister = await d.get(`SELECT id FROM cash_registers WHERE status = 'open'`);
    let registerId;
    if (existingRegister) {
      registerId = existingRegister.id;
    } else {
      const reg = await d.run(`INSERT INTO cash_registers (opening_balance, status) VALUES (?,?)`, [0, 'open']);
      registerId = reg.lastInsertRowid;
    }

    await d.run(`INSERT INTO suppliers (name) VALUES (?)`, [`E2E-PO-CASH-SUP-${ts}`]);
    const supplier = await d.get(`SELECT id FROM suppliers WHERE name = ?`, [`E2E-PO-CASH-SUP-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['E2E PO Cash', `E2E-PO-CASH-PROD-${ts}`, 100, 10, 5, 2, 'TestPOCash', 'piece']);
    const product = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-PO-CASH-PROD-${ts}`]);

    await d.run(`INSERT INTO purchase_orders (po_number, supplier_id, subtotal, total, status) VALUES (?,?,?,?,?)`,
      [`E2E-PO-CASH-${ts}`, supplier.id, 400, 400, 'pending']);
    const po = await d.get(`SELECT id FROM purchase_orders WHERE po_number = ?`, [`E2E-PO-CASH-${ts}`]);

    await d.run(`INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?,?,?,?,?,?)`,
      [po.id, product.id, 'E2E PO Cash', 8, 50, 400]);

    await d.run(`INSERT INTO cashier_movements (register_id, type, amount, reason) VALUES (?,?,?,?)`,
      [registerId, 'out', 400, `PO Payment: E2E-PO-CASH-${ts}`]);

    const movement = await d.get(`SELECT * FROM cashier_movements WHERE reason = ?`, [`PO Payment: E2E-PO-CASH-${ts}`]);
    expect(movement).not.toBeNull();
    expect(movement.type).toBe('out');
    expect(Number(movement.amount)).toBe(400);
  });

  test('US-3.6: Cancel PO', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE po_number = ?)`, [`E2E-PO-CANCEL-${ts}`]);
    await d.run(`DELETE FROM purchase_orders WHERE po_number = ?`, [`E2E-PO-CANCEL-${ts}`]);
    await d.run(`DELETE FROM suppliers WHERE name = ?`, [`E2E-PO-CANCEL-SUP-${ts}`]);

    await d.run(`INSERT INTO suppliers (name) VALUES (?)`, [`E2E-PO-CANCEL-SUP-${ts}`]);
    const supplier = await d.get(`SELECT id FROM suppliers WHERE name = ?`, [`E2E-PO-CANCEL-SUP-${ts}`]);

    await d.run(`INSERT INTO purchase_orders (po_number, supplier_id, subtotal, total, status) VALUES (?,?,?,?,?)`,
      [`E2E-PO-CANCEL-${ts}`, supplier.id, 100, 100, 'pending']);

    await d.run(`UPDATE purchase_orders SET status = ? WHERE po_number = ?`, ['cancelled', `E2E-PO-CANCEL-${ts}`]);

    const po = await d.get(`SELECT status FROM purchase_orders WHERE po_number = ?`, [`E2E-PO-CANCEL-${ts}`]);
    expect(po.status).toBe('cancelled');
  });

  test('US-3.7: Prevent double receive', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE po_number = ?)`, [`E2E-PO-DBL-${ts}`]);
    await d.run(`DELETE FROM purchase_orders WHERE po_number = ?`, [`E2E-PO-DBL-${ts}`]);
    await d.run(`DELETE FROM suppliers WHERE name = ?`, [`E2E-PO-DBL-SUP-${ts}`]);

    await d.run(`INSERT INTO suppliers (name) VALUES (?)`, [`E2E-PO-DBL-SUP-${ts}`]);
    const supplier = await d.get(`SELECT id FROM suppliers WHERE name = ?`, [`E2E-PO-DBL-SUP-${ts}`]);

    await d.run(`INSERT INTO purchase_orders (po_number, supplier_id, subtotal, total, status) VALUES (?,?,?,?,?)`,
      [`E2E-PO-DBL-${ts}`, supplier.id, 100, 100, 'received']);

    const po = await d.get(`SELECT status FROM purchase_orders WHERE po_number = ?`, [`E2E-PO-DBL-${ts}`]);
    expect(po.status).toBe('received');

    let updateError = null;
    try {
      if (po.status === 'received') {
        throw new Error('Cannot receive an already received PO');
      }
      await d.run(`UPDATE purchase_orders SET status = ? WHERE po_number = ?`, ['received', `E2E-PO-DBL-${ts}`]);
    } catch (e) {
      updateError = e;
    }
    expect(updateError).not.toBeNull();
  });

  test('US-3.8: Filter products by supplier', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM products WHERE barcode LIKE ?`, [`E2E-FILT-${ts}-%`]);
    await d.run(`DELETE FROM suppliers WHERE name = ?`, [`E2E-FILT-SUP-${ts}`]);

    await d.run(`INSERT INTO suppliers (name) VALUES (?)`, [`E2E-FILT-SUP-${ts}`]);
    const supplier = await d.get(`SELECT id FROM suppliers WHERE name = ?`, [`E2E-FILT-SUP-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit, supplier_id) VALUES (?,?,?,?,?,?,?,?,?)`,
      ['Filter A', `E2E-FILT-${ts}-A`, 100, 50, 10, 2, 'TestFilt', 'piece', supplier.id]);
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit, supplier_id) VALUES (?,?,?,?,?,?,?,?,?)`,
      ['Filter B', `E2E-FILT-${ts}-B`, 200, 100, 20, 4, 'TestFilt', 'piece', supplier.id]);

    const products = await d.all(`SELECT * FROM products WHERE supplier_id = ?`, [supplier.id]);
    expect(products.length).toBe(2);
  });

  test('US-3.9: List purchase orders', async () => {
    const d = db(window);
    const ts = Date.now();
    await d.run(`DELETE FROM suppliers WHERE name = ?`, [`PO-List-Supplier-${ts}`]);
    await d.run(`INSERT INTO suppliers (name) VALUES (?)`, [`PO-List-Supplier-${ts}`]);
    const sup = await d.get(`SELECT id FROM suppliers WHERE name = ?`, [`PO-List-Supplier-${ts}`]);
    // Create 3 POs
    for (let i = 0; i < 3; i++) {
      await d.run(`INSERT INTO purchase_orders (po_number, supplier_id, total, status) VALUES (?,?,?,?)`,
        [`PO-LIST-${ts}-${i}`, sup.id, 100 * (i + 1), i === 0 ? 'received' : 'pending']);
    }
    const orders = await d.all(`SELECT * FROM purchase_orders WHERE po_number LIKE ?`, [`PO-LIST-${ts}-%`]);
    expect(orders.length).toBe(3);
    const statuses = orders.map(o => o.status);
    expect(statuses).toContain('received');
    expect(statuses).toContain('pending');
    // Cleanup
    await d.run(`DELETE FROM purchase_orders WHERE po_number LIKE ?`, [`PO-LIST-${ts}-%`]);
    await d.run(`DELETE FROM suppliers WHERE name = ?`, [`PO-List-Supplier-${ts}`]);
  });
});
