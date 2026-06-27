import { test, expect } from '../../tests/fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('E2E - Products', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('جاري التحميل');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
  });

  test('US-1.1: Create product with all fields', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-PROD-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['E2E Product', `E2E-PROD-${ts}`, 150, 80, 20, 5, 'TestCat', 'piece']);

    const product = await d.get(`SELECT * FROM products WHERE barcode = ?`, [`E2E-PROD-${ts}`]);
    expect(product).not.toBeNull();
    expect(product.name).toBe('E2E Product');
    expect(Number(product.price)).toBe(150);
    expect(Number(product.cost)).toBe(80);
    expect(Number(product.stock)).toBe(20);
    expect(product.category).toBe('TestCat');
    expect(product.unit).toBe('piece');
  });

  test('US-1.2: Create product with auto barcode', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM products WHERE name = ?`, [`E2E-AutoBarcode-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      [`E2E-AutoBarcode-${ts}`, null, 100, 50, 10, 2, 'TestAuto', 'piece']);

    const product = await d.get(`SELECT * FROM products WHERE name = ?`, [`E2E-AutoBarcode-${ts}`]);
    expect(product).not.toBeNull();
    const barcode = product.barcode || '';
    expect(barcode.length).toBeGreaterThan(0);
  });

  test('US-1.3: Update product', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-UPDATE-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Old Name', `E2E-UPDATE-${ts}`, 100, 50, 10, 2, 'TestUpd', 'piece']);

    await d.run(`UPDATE products SET name = ?, price = ? WHERE barcode = ?`,
      ['Updated Name', 200, `E2E-UPDATE-${ts}`]);

    const product = await d.get(`SELECT name, price FROM products WHERE barcode = ?`, [`E2E-UPDATE-${ts}`]);
    expect(product.name).toBe('Updated Name');
    expect(Number(product.price)).toBe(200);
  });

  test('US-1.4: Delete product', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-DEL-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['To Delete', `E2E-DEL-${ts}`, 50, 25, 5, 1, 'TestDel', 'piece']);

    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-DEL-${ts}`]);

    const product = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-DEL-${ts}`]);
    expect(product).toBeUndefined();
  });

  test('US-1.5: Supplier assignment', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-SUP-${ts}`]);
    await d.run(`DELETE FROM suppliers WHERE name = ?`, [`E2E-Supplier-${ts}`]);

    await d.run(`INSERT INTO suppliers (name) VALUES (?)`, [`E2E-Supplier-${ts}`]);
    const supplier = await d.get(`SELECT id FROM suppliers WHERE name = ?`, [`E2E-Supplier-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit, supplier_id) VALUES (?,?,?,?,?,?,?,?,?)`,
      ['E2E Supplier Prod', `E2E-SUP-${ts}`, 200, 100, 15, 3, 'TestSup', 'piece', supplier.id]);

    const product = await d.get(
      `SELECT p.name, p.supplier_id, s.name as supplier_name FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.barcode = ?`,
      [`E2E-SUP-${ts}`]);
    expect(product).not.toBeNull();
    expect(product.supplier_id).toBe(supplier.id);
    expect(product.supplier_name).toBe(`E2E-Supplier-${ts}`);
  });

  test('US-1.7: Duplicate barcode rejection', async () => {
    const d = db(window);
    const ts = Date.now();
    const barcode = `E2E-DUP-${ts}`;

    await d.run(`DELETE FROM products WHERE barcode = ?`, [barcode]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['First', barcode, 100, 50, 10, 2, 'TestDup', 'piece']);

    let error = null;
    try {
      await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
        ['Second', barcode, 200, 100, 20, 4, 'TestDup', 'piece']);
    } catch (e) {
      error = e;
    }
    expect(error).not.toBeNull();
  });

  test('US-1.8: Category stats query', async () => {
    const d = db(window);
    const ts = Date.now();
    const category = `E2E-CAT-${ts}`;

    await d.run(`DELETE FROM products WHERE category = ?`, [category]);

    for (let i = 0; i < 3; i++) {
      await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
        [`E2E Cat Prod ${i}`, `${category}-${i}`, 100, 50, 10, 2, category, 'piece']);
    }

    const stats = await d.get(`SELECT category, COUNT(*) as count, SUM(stock) as total_stock FROM products WHERE category = ? GROUP BY category`, [category]);
    expect(stats).not.toBeNull();
    expect(Number(stats.count)).toBe(3);
  });

  test('US-1.9: List products with pagination', async () => {
    const d = db(window);
    // Insert 25 products
    for (let i = 0; i < 25; i++) {
      await d.run(`INSERT INTO products (name, barcode, price, cost, stock) VALUES (?,?,?,?,?)`,
        [`Paginate Product ${i}`, `PAG-BAR-${i}`, 10 + i, 5 + i, 100]);
    }
    // Query with LIMIT 20 OFFSET 0 (page 1)
    const page1 = await d.all('SELECT * FROM products ORDER BY id ASC LIMIT 20 OFFSET 0');
    expect(page1.length).toBe(20);
    // Query with LIMIT 20 OFFSET 20 (page 2)
    const page2 = await d.all('SELECT * FROM products ORDER BY id ASC LIMIT 20 OFFSET 20');
    expect(page2.length).toBe(5);
    // Cleanup
    await d.run(`DELETE FROM products WHERE barcode LIKE 'PAG-BAR-%'`);
  });
});
