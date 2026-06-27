import { test, expect } from '../fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('Phase 3 - Stock Movements Log', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    const d = db(w);
    const ts = Date.now();
    await d.run(
      `INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      [`Mov Test ${ts}`, `MOV-${ts}`, 50, 25, 30, 5, 'Beverages', 'piece']
    );
  });

  test('3.7.1 - Inventory page has filter by product and can view per-product movements', async () => {
    await window.click('text=المخزون');
    await window.waitForTimeout(500);
    const body = await window.locator('body').textContent();
    expect(body).toContain('تصفية بالمنتج');
  });

  test('3.7.2 - Damage movement type can be logged and appears in inventory', async () => {
    const d = db(window);
    const prod = await d.get('SELECT id, stock FROM products WHERE name LIKE ?', ['Mov Test%']);
    await d.run(
      'INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, notes) VALUES (?,?,?,?,?,?)',
      [prod.id, 'damage', 2, prod.stock, prod.stock - 2, 'Damaged in storage']
    );
    await d.run('UPDATE products SET stock = ? WHERE id = ?', [prod.stock - 2, prod.id]);

    await window.click('text=المخزون');
    await window.waitForTimeout(500);
    const body = await window.locator('body').textContent();
    expect(body).toContain('تلف');
  });

  test('3.7.3 - Audit movement type can be logged', async () => {
    const d = db(window);
    const prod = await d.get('SELECT id, stock FROM products WHERE name LIKE ?', ['Mov Test%']);
    const newStock = prod.stock - 1;
    await d.run(
      'INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, notes) VALUES (?,?,?,?,?,?)',
      [prod.id, 'audit', 1, prod.stock, newStock, 'Audit adjustment']
    );
    await d.run('UPDATE products SET stock = ? WHERE id = ?', [newStock, prod.id]);

    await window.click('text=المخزون');
    await window.waitForTimeout(500);
    const body = await window.locator('body').textContent();
    expect(body).toContain('جرد');
  });

  test('3.7.4 - Warehouse transfer movement type can be logged', async () => {
    const d = db(window);
    const prod = await d.get('SELECT id, stock FROM products WHERE name LIKE ?', ['Mov Test%']);
    await d.run(
      'INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, notes) VALUES (?,?,?,?,?,?)',
      [prod.id, 'warehouse_transfer', 5, prod.stock, prod.stock + 5, 'Transfer from warehouse A']
    );
    await d.run('UPDATE products SET stock = ? WHERE id = ?', [prod.stock + 5, prod.id]);

    await window.click('text=المخزون');
    await window.waitForTimeout(500);
    const body = await window.locator('body').textContent();
    expect(body).toContain('تحويل');
  });

  test('3.7.5 - Export movements button exists on inventory page', async () => {
    await window.click('text=المخزون');
    await window.waitForTimeout(500);
    const btn = window.locator('button:has-text("تصدير")');
    await expect(btn).toBeVisible();
  });

  test('3.7.6 - All movement types are shown with correct labels in table', async () => {
    const d = db(window);
    const prod = await d.get('SELECT id, stock FROM products WHERE name LIKE ?', ['Mov Test%']);
    for (const [type, label] of [['add', 'إضافة'], ['subtract', 'سحب'], ['sale', 'بيع'], ['return', 'مرتجع'], ['damage', 'تلف'], ['audit', 'جرد']]) {
      await d.run(
        'INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, notes) VALUES (?,?,?,?,?,?)',
        [prod.id, type, 1, prod.stock, type === 'subtract' ? prod.stock - 1 : prod.stock + 1, `test ${type}`]
      );
    }

    await window.click('text=المخزون');
    await window.waitForTimeout(500);
    const body = await window.locator('body').textContent();
    expect(body).toContain('إضافة');
    expect(body).toContain('سحب');
    expect(body).toContain('بيع');
    expect(body).toContain('مرتجع');
    expect(body).toContain('تلف');
    expect(body).toContain('جرد');
  });
});
