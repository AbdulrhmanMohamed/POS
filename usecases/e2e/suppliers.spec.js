import { test, expect } from '../../tests/fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('E2E - Suppliers', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
  });

  test('US-7.1: Create supplier', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM suppliers WHERE name = ?`, [`E2E-SUP-CREATE-${ts}`]);

    await d.run(`INSERT INTO suppliers (name, phone, balance) VALUES (?,?,?)`,
      [`E2E-SUP-CREATE-${ts}`, '123456', 0]);

    const supplier = await d.get(`SELECT * FROM suppliers WHERE name = ?`, [`E2E-SUP-CREATE-${ts}`]);
    expect(supplier).not.toBeNull();
    expect(supplier.name).toBe(`E2E-SUP-CREATE-${ts}`);
    expect(supplier.phone).toBe('123456');
    expect(Number(supplier.balance)).toBe(0);
  });

  test('US-7.2: Update supplier', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM suppliers WHERE name = ?`, [`E2E-SUP-UPDATE-${ts}`]);

    await d.run(`INSERT INTO suppliers (name, phone, balance) VALUES (?,?,?)`,
      [`E2E-SUP-UPDATE-${ts}`, '111111', 0]);

    await d.run(`UPDATE suppliers SET name = ?, phone = ? WHERE name = ?`,
      [`E2E-SUP-UPDATED-${ts}`, '222222', `E2E-SUP-UPDATE-${ts}`]);

    const supplier = await d.get(`SELECT * FROM suppliers WHERE name = ?`, [`E2E-SUP-UPDATED-${ts}`]);
    expect(supplier).not.toBeNull();
    expect(supplier.phone).toBe('222222');
  });

  test('US-7.3: Delete supplier', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE po_number = ?)`, [`E2E-SUP-DEL-PO-${ts}`]);
    await d.run(`DELETE FROM purchase_orders WHERE po_number = ?`, [`E2E-SUP-DEL-PO-${ts}`]);
    await d.run(`DELETE FROM products WHERE supplier_id IN (SELECT id FROM suppliers WHERE name = ?)`, [`E2E-SUP-DEL-${ts}`]);
    await d.run(`DELETE FROM suppliers WHERE name = ?`, [`E2E-SUP-DEL-${ts}`]);

    await d.run(`INSERT INTO suppliers (name, phone, balance) VALUES (?,?,?)`,
      [`E2E-SUP-DEL-${ts}`, '333333', 0]);

    await d.run(`DELETE FROM suppliers WHERE name = ?`, [`E2E-SUP-DEL-${ts}`]);

    const supplier = await d.get(`SELECT id FROM suppliers WHERE name = ?`, [`E2E-SUP-DEL-${ts}`]);
    expect(supplier).toBeUndefined();
  });

  test('US-7.4: Balance auto-update on PO receive', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE po_number = ?)`, [`E2E-SUP-BAL-${ts}`]);
    await d.run(`DELETE FROM purchase_orders WHERE po_number = ?`, [`E2E-SUP-BAL-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-SUP-BAL-PROD-${ts}`]);
    await d.run(`DELETE FROM suppliers WHERE name = ?`, [`E2E-SUP-BAL-${ts}`]);

    await d.run(`INSERT INTO suppliers (name, balance) VALUES (?,?)`, [`E2E-SUP-BAL-${ts}`, 0]);
    const supplier = await d.get(`SELECT id, balance FROM suppliers WHERE name = ?`, [`E2E-SUP-BAL-${ts}`]);
    const balanceBefore = Number(supplier.balance);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Sup Bal Prod', `E2E-SUP-BAL-PROD-${ts}`, 100, 50, 10, 2, 'TestSup', 'piece']);
    const product = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-SUP-BAL-PROD-${ts}`]);

    const poTotal = 500;
    await d.run(`INSERT INTO purchase_orders (po_number, supplier_id, subtotal, total, status) VALUES (?,?,?,?,?)`,
      [`E2E-SUP-BAL-${ts}`, supplier.id, poTotal, poTotal, 'received']);

    await d.run(`UPDATE suppliers SET balance = balance + ? WHERE id = ?`, [poTotal, supplier.id]);

    const supplierAfter = await d.get(`SELECT balance FROM suppliers WHERE id = ?`, [supplier.id]);
    expect(Number(supplierAfter.balance)).toBe(balanceBefore + poTotal);
  });

  test('US-7.5: Products assigned to supplier', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-SUP-PROD-${ts}`]);
    await d.run(`DELETE FROM suppliers WHERE name = ?`, [`E2E-SUP-ASSIGN-${ts}`]);

    await d.run(`INSERT INTO suppliers (name) VALUES (?)`, [`E2E-SUP-ASSIGN-${ts}`]);
    const supplier = await d.get(`SELECT id FROM suppliers WHERE name = ?`, [`E2E-SUP-ASSIGN-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit, supplier_id) VALUES (?,?,?,?,?,?,?,?,?)`,
      ['Assigned Prod', `E2E-SUP-PROD-${ts}`, 150, 70, 20, 5, 'TestSup', 'piece', supplier.id]);

    const product = await d.get(
      `SELECT p.name, p.supplier_id, s.name as supplier_name FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.barcode = ?`,
      [`E2E-SUP-PROD-${ts}`]);
    expect(product).not.toBeNull();
    expect(product.supplier_id).toBe(supplier.id);
    expect(product.supplier_name).toBe(`E2E-SUP-ASSIGN-${ts}`);
  });

  test('US-7.6: List all suppliers', async () => {
    const d = db(window);
    const ts = Date.now();
    for (let i = 0; i < 3; i++) {
      await d.run(`DELETE FROM suppliers WHERE name = ?`, [`List Supplier ${ts} ${i}`]);
      await d.run(`INSERT INTO suppliers (name, phone) VALUES (?,?)`,
        [`List Supplier ${ts} ${i}`, `012${i}0000000`]);
    }
    const all = await d.all(`SELECT * FROM suppliers WHERE name LIKE ?`, [`List Supplier ${ts} %`]);
    expect(all.length).toBe(3);
    for (let i = 0; i < 3; i++) {
      await d.run(`DELETE FROM suppliers WHERE name = ?`, [`List Supplier ${ts} ${i}`]);
    }
  });
});
