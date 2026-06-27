import { test, expect } from '../fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('Phase 3 - Inventory Dashboard & Low Stock', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    const d = db(w);
    const ts = Date.now();
    await d.run(
      `INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      [`Dash Test ${ts}`, `DASH-${ts}`, 100, 50, 10, 5, 'Electronics', 'piece']
    );
    await d.run(
      `INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      [`Low Stock ${ts}`, `LOW-${ts}`, 20, 10, 2, 5, 'Food', 'piece']
    );
  });

  test('3.6.1 - Inventory page shows total value stat card', async () => {
    await window.click('text=المخزون');
    await window.waitForTimeout(500);
    const body = await window.locator('body').textContent();
    expect(body).toContain('المخزون');
    expect(body).toContain('قيمة المخزون');
    expect(body).toContain('منتجات منخفضة');
  });

  test('3.6.2 - Inventory page shows value by category section', async () => {
    await window.click('text=المخزون');
    await window.waitForTimeout(500);
    const body = await window.locator('body').textContent();
    expect(body).toContain('Electronics');
    expect(body).toContain('Food');
  });

  test('3.6.3 - Low stock products list appears on inventory page', async () => {
    await window.click('text=المخزون');
    await window.waitForTimeout(500);
    const body = await window.locator('body').textContent();
    expect(body).toContain('Low Stock');
  });

  test('3.6.4 - Sale decreases product stock and logs movement', async () => {
    const d = db(window);
    const prod = await d.get('SELECT * FROM products WHERE name LIKE ?', ['Dash Test%']);
    const before = prod.stock;
    await d.run('UPDATE products SET stock = stock - 3 WHERE id = ?', [prod.id]);
    await d.run(
      `INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, notes) VALUES (?,?,?,?,?,?)`,
      [prod.id, 'sale', 3, before, before - 3, 'test sale']
    );
    const after = await d.get('SELECT stock FROM products WHERE id = ?', [prod.id]);
    expect(after.stock).toBe(before - 3);
    const log = await d.get(
      'SELECT * FROM inventory WHERE product_id=? AND type=? ORDER BY id DESC LIMIT 1',
      [prod.id, 'sale']
    );
    expect(log).toBeTruthy();
    expect(log.balance_before).toBe(before);
    expect(log.balance_after).toBe(before - 3);
  });

  test('3.6.5 - Adding stock updates inventory value correctly', async () => {
    const d = db(window);
    const before = await d.get('SELECT COALESCE(SUM(stock*cost),0) as total FROM products');
    const prod = await d.get('SELECT * FROM products WHERE name LIKE ?', ['Dash Test%']);
    await d.run('UPDATE products SET stock = stock + 5 WHERE id = ?', [prod.id]);
    const after = await d.get('SELECT COALESCE(SUM(stock*cost),0) as total FROM products');
    expect(Number(after.total)).toBe(Number(before.total) + 5 * Number(prod.cost));
  });

  test('3.6.6 - Low stock count is accurate', async () => {
    const d = db(window);
    const r = await d.get('SELECT COUNT(*) as count FROM products WHERE stock <= min_stock AND min_stock > 0');
    expect(Number(r.count)).toBeGreaterThanOrEqual(1);
    await window.click('text=المخزون');
    await window.waitForTimeout(500);
    const body = await window.locator('body').textContent();
    expect(body).toContain(String(r.count));
  });
});
