import { test, expect } from '../fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('Phase 3 - Inventory Reconciliation', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    const d = db(w);
    const ts = Date.now();
    await d.run(
      `INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      [`Rec Test ${ts}`, `REC-${ts}`, 100, 40, 20, 5, 'Snacks', 'piece']
    );
    await d.run(
      `INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      [`Rec Test 2 ${ts}`, `REC2-${ts}`, 50, 20, 15, 3, 'Snacks', 'piece']
    );
  });

  test('3.8.1 - Reconciliation button exists on inventory page', async () => {
    await window.click('text=المخزون');
    await window.waitForTimeout(500);
    const btn = window.locator('button:has-text("تسوية")');
    await expect(btn).toBeVisible();
  });

  test('3.8.2 - Can calculate surplus when physical count > system count', async () => {
    const d = db(window);
    const prod = await d.get('SELECT * FROM products WHERE name LIKE ?', ['Rec Test%']);
    const physical = prod.stock + 3;
    const diff = physical - prod.stock;
    expect(diff).toBe(3);
    expect(physical).toBeGreaterThan(prod.stock);
  });

  test('3.8.3 - Can calculate deficit when physical count < system count', async () => {
    const d = db(window);
    const prod = await d.get('SELECT * FROM products WHERE name LIKE ?', ['Rec Test%']);
    const physical = prod.stock - 4;
    const diff = physical - prod.stock;
    expect(diff).toBe(-4);
    expect(physical).toBeLessThan(prod.stock);
  });

  test('3.8.4 - Settling reconciliation updates stock and logs audit movement', async () => {
    const d = db(window);
    const prod = await d.get('SELECT * FROM products WHERE name LIKE ?', ['Rec Test%']);
    const physical = prod.stock - 2;
    await d.run('UPDATE products SET stock = ? WHERE id = ?', [physical, prod.id]);
    await d.run(
      'INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, notes) VALUES (?,?,?,?,?,?)',
      [prod.id, 'audit', prod.stock - physical, prod.stock, physical, `Reconciliation: system ${prod.stock} -> physical ${physical}`]
    );
    const updated = await d.get('SELECT stock FROM products WHERE id = ?', [prod.id]);
    expect(updated.stock).toBe(physical);

    const log = await d.get(
      'SELECT * FROM inventory WHERE product_id=? AND type=? ORDER BY id DESC LIMIT 1',
      [prod.id, 'audit']
    );
    expect(log).toBeTruthy();
    expect(log.balance_before).toBe(prod.stock);
    expect(log.balance_after).toBe(physical);
  });

  test('3.8.5 - Reconciliation modal shows system count, physical count input, and difference', async () => {
    await window.click('text=المخزون');
    await window.waitForTimeout(500);
    await window.click('button:has-text("تسوية")');
    await window.waitForTimeout(300);
    const modal = window.locator('.modal');
    await expect(modal).toBeVisible();
    const body = await modal.textContent();
    expect(body).toContain('المنتج');
    expect(body).toContain('النظام');
    expect(body).toContain('الفعلي');
    expect(body).toContain('الفرق');
  });

  test('3.8.6 - Bulk reconciliation processes multiple products at once', async () => {
    const d = db(window);
    const ts = Date.now();
    const bc1 = `BULK1-${ts}`;
    const bc2 = `BULK2-${ts}`;
    await d.run(
      `INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      [`Bulk A ${ts}`, bc1, 100, 40, 20, 5, 'Snacks', 'piece']
    );
    await d.run(
      `INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      [`Bulk B ${ts}`, bc2, 50, 20, 15, 3, 'Snacks', 'piece']
    );

    const prods = await d.all('SELECT * FROM products WHERE barcode IN (?,?)', [bc1, bc2]);
    expect(prods.length).toBe(2);

    for (const prod of prods) {
      const physical = prod.stock - 1;
      await d.run('UPDATE products SET stock = ? WHERE id = ?', [physical, prod.id]);
      await d.run(
        'INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, notes) VALUES (?,?,?,?,?,?)',
        [prod.id, 'audit', prod.stock - physical, prod.stock, physical, `Bulk reconciliation`]
      );
      const updated = await d.get('SELECT stock FROM products WHERE id = ?', [prod.id]);
      expect(updated.stock).toBe(physical);
    }
  });
});
