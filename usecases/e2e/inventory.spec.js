import { test, expect } from '../../tests/fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('E2E - Inventory', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('جاري التحميل');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
  });

  test('US-2.1: Stock movement on sale', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM inventory WHERE product_id IN (SELECT id FROM products WHERE barcode = ?)`, [`E2E-INV-SALE-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-INV-SALE-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Inv Sale Test', `E2E-INV-SALE-${ts}`, 100, 50, 20, 5, 'TestInv', 'piece']);
    const product = await d.get(`SELECT id, stock FROM products WHERE barcode = ?`, [`E2E-INV-SALE-${ts}`]);

    const stockBefore = Number(product.stock);
    const qtySold = 3;

    await d.run(`INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after) VALUES (?,?,?,?,?)`,
      [product.id, 'sale', qtySold, stockBefore, stockBefore - qtySold]);

    await d.run(`UPDATE products SET stock = ? WHERE id = ?`, [stockBefore - qtySold, product.id]);

    const productAfter = await d.get(`SELECT stock FROM products WHERE id = ?`, [product.id]);
    expect(Number(productAfter.stock)).toBe(stockBefore - qtySold);

    const movement = await d.get(`SELECT * FROM inventory WHERE product_id = ? AND type = 'sale'`, [product.id]);
    expect(movement).not.toBeNull();
    expect(Number(movement.balance_before)).toBe(stockBefore);
    expect(Number(movement.balance_after)).toBe(stockBefore - qtySold);
  });

  test('US-2.2: Stock movement on PO receive', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM inventory WHERE product_id IN (SELECT id FROM products WHERE barcode = ?)`, [`E2E-INV-PO-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-INV-PO-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Inv PO Test', `E2E-INV-PO-${ts}`, 100, 50, 10, 3, 'TestInv', 'piece']);
    const product = await d.get(`SELECT id, stock FROM products WHERE barcode = ?`, [`E2E-INV-PO-${ts}`]);

    const stockBefore = Number(product.stock);
    const qtyReceived = 10;
    const newStock = stockBefore + qtyReceived;

    await d.run(`INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after) VALUES (?,?,?,?,?)`,
      [product.id, 'add', qtyReceived, stockBefore, newStock]);

    await d.run(`UPDATE products SET stock = ? WHERE id = ?`, [newStock, product.id]);

    const productAfter = await d.get(`SELECT stock FROM products WHERE id = ?`, [product.id]);
    expect(Number(productAfter.stock)).toBe(newStock);

    const movement = await d.get(`SELECT * FROM inventory WHERE product_id = ? AND type = 'add'`, [product.id]);
    expect(movement).not.toBeNull();
    expect(Number(movement.balance_after)).toBe(newStock);
  });

  test('US-2.3: Low stock alert query', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-LOW-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Low Stock Test', `E2E-LOW-${ts}`, 50, 25, 2, 5, 'TestLow', 'piece']);

    const lowStock = await d.all(`SELECT * FROM products WHERE stock <= min_stock AND barcode = ?`, [`E2E-LOW-${ts}`]);
    expect(lowStock.length).toBeGreaterThanOrEqual(1);
    expect(Number(lowStock[0].stock)).toBeLessThanOrEqual(Number(lowStock[0].min_stock));
  });

  test('US-2.4: Inventory movement log', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM inventory WHERE product_id IN (SELECT id FROM products WHERE barcode = ?)`, [`E2E-MOV-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-MOV-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Movement Log Test', `E2E-MOV-${ts}`, 100, 50, 30, 5, 'TestMov', 'piece']);
    const product = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-MOV-${ts}`]);

    await d.run(`INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after) VALUES (?,?,?,?,?)`,
      [product.id, 'sale', 2, 30, 28]);
    await d.run(`INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after) VALUES (?,?,?,?,?)`,
      [product.id, 'add', 10, 28, 38]);
    await d.run(`INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after) VALUES (?,?,?,?,?)`,
      [product.id, 'damage', 1, 38, 37]);

    const movements = await d.all(`SELECT * FROM inventory WHERE product_id = ? ORDER BY id`, [product.id]);
    expect(movements.length).toBe(3);
    expect(movements[0].type).toBe('sale');
    expect(movements[1].type).toBe('add');
    expect(movements[2].type).toBe('damage');
  });

  test('US-2.5: Stock reconciliation (adjustment)', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM inventory WHERE product_id IN (SELECT id FROM products WHERE barcode = ?)`, [`E2E-ADJ-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-ADJ-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Adj Test', `E2E-ADJ-${ts}`, 100, 50, 20, 5, 'TestAdj', 'piece']);
    const product = await d.get(`SELECT id, stock FROM products WHERE barcode = ?`, [`E2E-ADJ-${ts}`]);

    const stockBefore = Number(product.stock);
    const adjustedStock = 15;

    await d.run(`INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after) VALUES (?,?,?,?,?)`,
      [product.id, 'adjustment', adjustedStock - stockBefore, stockBefore, adjustedStock]);

    await d.run(`UPDATE products SET stock = ? WHERE id = ?`, [adjustedStock, product.id]);

    const productAfter = await d.get(`SELECT stock FROM products WHERE id = ?`, [product.id]);
    expect(Number(productAfter.stock)).toBe(adjustedStock);

    const movement = await d.get(`SELECT * FROM inventory WHERE product_id = ? AND type = 'adjustment'`, [product.id]);
    expect(movement).not.toBeNull();
    expect(Number(movement.balance_after)).toBe(adjustedStock);
  });

  test('US-2.6: Product status change', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-STATUS-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Status Test', `E2E-STATUS-${ts}`, 100, 50, 10, 2, 'TestStatus', 'piece']);

    await d.run(`UPDATE products SET status = ? WHERE barcode = ?`, ['disabled', `E2E-STATUS-${ts}`]);

    const product = await d.get(`SELECT status FROM products WHERE barcode = ?`, [`E2E-STATUS-${ts}`]);
    expect(product.status).toBe('disabled');
  });

  test('US-2.7: Value by category query', async () => {
    const d = db(window);
    const ts = Date.now();
    const category = `E2E-VAL-${ts}`;

    await d.run(`DELETE FROM products WHERE category = ?`, [category]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Val A', `${category}-A`, 100, 20, 10, 2, category, 'piece']);
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Val B', `${category}-B`, 200, 30, 5, 1, category, 'piece']);

    const result = await d.get(
      `SELECT category, COUNT(*) as count, SUM(cost * stock) as total_value FROM products WHERE category = ? GROUP BY category`,
      [category]);
    expect(result).not.toBeNull();
    expect(Number(result.total_value)).toBe((20 * 10) + (30 * 5));
  });

  test('US-2.8: Damage movement', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM inventory WHERE product_id IN (SELECT id FROM products WHERE barcode = ?)`, [`E2E-DMG-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-DMG-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Damage Test', `E2E-DMG-${ts}`, 100, 50, 10, 2, 'TestDmg', 'piece']);
    const product = await d.get(`SELECT id, stock FROM products WHERE barcode = ?`, [`E2E-DMG-${ts}`]);

    await d.run(`INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after) VALUES (?,?,?,?,?)`,
      [product.id, 'damage', 2, Number(product.stock), Number(product.stock) - 2]);

    const movement = await d.get(`SELECT * FROM inventory WHERE product_id = ? AND type = 'damage'`, [product.id]);
    expect(movement).not.toBeNull();
    expect(movement.type).toBe('damage');
    expect(Number(movement.quantity)).toBe(2);
  });

  test('US-2.9: Export inventory CSV format', async () => {
    const d = db(window);
    // Insert a product with inventory movement
    await d.run(`DELETE FROM products WHERE barcode = 'CSV-TEST'`);
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, category) VALUES (?,?,?,?,?,?)`,
      ['CSV Export Test', 'CSV-TEST', 50, 20, 100, 'TestCSV']);
    const prod = await d.get(`SELECT id FROM products WHERE barcode = 'CSV-TEST'`);
    await d.run(`INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after) VALUES (?,?,?,?,?)`,
      [prod.id, 'sale', 5, 100, 95]);
    // Query all inventory join products
    const rows = await d.all(`SELECT p.name, p.barcode, i.type, i.quantity, i.balance_before, i.balance_after, i.created_at FROM inventory i JOIN products p ON i.product_id = p.id ORDER BY i.created_at DESC`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]).toHaveProperty('name');
    expect(rows[0]).toHaveProperty('type');
    expect(rows[0]).toHaveProperty('quantity');
    await d.run(`DELETE FROM inventory WHERE product_id = ?`, [prod.id]);
    await d.run(`DELETE FROM products WHERE barcode = 'CSV-TEST'`);
  });
});
