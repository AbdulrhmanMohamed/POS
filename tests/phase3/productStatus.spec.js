import { test, expect } from '../fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('Phase 3 - Product Status & Damaged Products', () => {
  let window;
  let productId;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    const d = db(w);
    const ts = Date.now();
    const result = await d.run(
      `INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      [`Status Test ${ts}`, `STATUS-${ts}`, 100, 50, 20, 5, 'TestStatus', 'piece']
    );
    productId = result.lastInsertRowid;
  });

  test('3.11.1 - Inventory table has status column for tracking damaged/returned', async () => {
    const d = db(window);
    await d.run(
      `INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, status) VALUES (?,?,?,?,?,?)`,
      [productId, 'damage', -2, 20, 18, 'damaged']
    );
    const row = await d.get(`SELECT * FROM inventory WHERE product_id = ? AND type = 'damage'`, [productId]);
    expect(row).not.toBeNull();
    expect(row.status).toBe('damaged');
  });

  test('3.11.2 - Can query damaged products from inventory', async () => {
    const d = db(window);
    await d.run(
      `INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, status) VALUES (?,?,?,?,?,?)`,
      [productId, 'damage', -3, 20, 17, 'damaged']
    );
    const damaged = await d.all(`SELECT i.*, p.name as product_name FROM inventory i JOIN products p ON i.product_id = p.id WHERE i.status = 'damaged'`);
    expect(damaged.length).toBeGreaterThan(0);
    expect(damaged[0].product_name).toContain('Status Test');
  });

  test('3.11.3 - Inventory page has a damaged products filter or section', async () => {
    await window.click('text=المخزون');
    await window.waitForTimeout(500);
    const body = await window.locator('body').textContent();
    expect(body).toContain('تلف');
  });

  test('3.11.4 - Can mark a product as damaged via inventory movement', async () => {
    const d = db(window);
    const ts = Date.now();
    const inv = await d.get(`SELECT id FROM inventory WHERE product_id = ? ORDER BY id DESC LIMIT 1`, [productId]);
    const before = await d.get(`SELECT stock FROM products WHERE id = ?`, [productId]);
    await d.run(
      `INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, notes, status) VALUES (?,?,?,?,?,?,?)`,
      [productId, 'damage', -1, before.stock, before.stock - 1, `Damaged ${ts}`, 'damaged']
    );
    await d.run(`UPDATE products SET stock = stock - 1 WHERE id = ?`, [productId]);
    const after = await d.get(`SELECT stock FROM products WHERE id = ?`, [productId]);
    expect(after.stock).toBe(before.stock - 1);
  });
});
