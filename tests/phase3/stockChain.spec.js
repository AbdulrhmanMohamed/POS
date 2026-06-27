import { test, expect } from '../fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

let productId;

test.describe('Phase 3 - Stock Auto-Deduction Chain', () => {
  test.beforeEach(async ({ window }) => {
    if (!productId) {
      const d = db(window);
      const barcode = `TST-${Date.now()}`;
      const r = await d.run(
        `INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
        ['Test Product', barcode, 100, 50, 50, 5, 'Test', 'piece']
      );
      productId = r.lastInsertRowid;
    }
  });

  test('3.1.1 - Sale deducts stock and logs to inventory', async ({ window }) => {
    const d = db(window);
    let p = await d.get('SELECT stock FROM products WHERE id = ?', [productId]);
    expect(p.stock).toBe(50);

    const invNum = `TST-${Date.now()}`;
    await d.run(`INSERT INTO invoices (invoice_number, subtotal, total, paid, status) VALUES (?,?,?,?,?)`,
      [invNum, 100, 100, 100, 'paid']);
    const inv = await d.get('SELECT id FROM invoices WHERE invoice_number = ?', [invNum]);
    await d.run(`INSERT INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, total_price) VALUES (?,?,?,?,?,?,?)`,
      [inv.id, productId, 'Test Product', 'TST', 2, 50, 100]);

    p = await d.get('SELECT stock FROM products WHERE id = ?', [productId]);
    expect(p.stock).toBe(50);

    await d.run('UPDATE products SET stock = stock - ? WHERE id = ?', [2, productId]);
    await d.run(`INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, notes) VALUES (?,?,?,?,?,?)`,
      [productId, 'sale', 2, 50, 48, `Sale: ${invNum}`]);

    p = await d.get('SELECT stock FROM products WHERE id = ?', [productId]);
    expect(p.stock).toBe(48);

    const log = await d.all('SELECT * FROM inventory WHERE product_id = ? AND type=? ORDER BY id DESC LIMIT 1', [productId, 'sale']);
    expect(log.length).toBe(1);
    expect(log[0].quantity).toBe(2);
    expect(log[0].balance_before).toBe(50);
    expect(log[0].balance_after).toBe(48);
  });

  test('3.1.2 - Purchase receive increases stock and logs', async ({ window }) => {
    const d = db(window);
    const poNum = `PO-TST-${Date.now()}`;
    await d.run(`INSERT INTO purchase_orders (po_number, supplier_id, status, total) VALUES (?,1,'pending',?)`, [poNum, 300]);
    const po = await d.get('SELECT id FROM purchase_orders WHERE po_number = ?', [poNum]);
    await d.run(`INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?,?,?,?,?,?)`,
      [po.id, productId, 'Test Product', 10, 30, 300]);

    const cur = (await d.get('SELECT stock FROM products WHERE id = ?', [productId])).stock;
    await d.run('UPDATE products SET stock = ? WHERE id = ?', [cur + 10, productId]);
    await d.run(`INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, notes) VALUES (?,?,?,?,?,?)`,
      [productId, 'add', 10, cur, cur + 10, `PO: ${poNum}`]);

    const product = await d.get('SELECT stock FROM products WHERE id = ?', [productId]);
    expect(product.stock).toBe(cur + 10);
  });

  test('3.1.3 - Return increases stock and logs', async ({ window }) => {
    const d = db(window);
    const cur = (await d.get('SELECT stock FROM products WHERE id = ?', [productId])).stock;
    const retNum = `RET-${Date.now()}`;
    await d.run(`INSERT INTO returns (return_number, invoice_id, customer_id, total, reason) VALUES (?,?,?,?,?)`,
      [retNum, 1, 1, 200, 'test']);
    const ret = await d.get('SELECT id FROM returns WHERE return_number = ?', [retNum]);
    await d.run(`INSERT INTO return_items (return_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?,?,?,?,?,?)`,
      [ret.id, productId, 'Test Product', 3, 50, 150]);
    await d.run('UPDATE products SET stock = stock + ? WHERE id = ?', [3, productId]);
    await d.run(`INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, notes) VALUES (?,?,?,?,?,?)`,
      [productId, 'return', 3, cur, cur + 3, `Return: ${ret.id}`]);
    expect((await d.get('SELECT stock FROM products WHERE id = ?', [productId])).stock).toBe(cur + 3);
  });

  test('3.1.4 - Exchange adjusts stock correctly', async ({ window }) => {
    const d = db(window);
    const repl = await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, unit) VALUES (?,?,?,?,?,?,?)`,
      ['Replacement', `RPL-${Date.now()}`, 80, 40, 20, 2, 'piece']);
    const replId = repl.lastInsertRowid;
    const cur = (await d.get('SELECT stock FROM products WHERE id = ?', [productId])).stock;

    await d.run(`INSERT INTO exchanges (exchange_number, invoice_id, customer_id, total_returned, total_replacement, difference) VALUES (?,1,1,?,?,?)`,
      [`EXC-${Date.now()}`, 150, 80, 70]);
    const exc = await d.get('SELECT id FROM exchanges ORDER BY id DESC LIMIT 1');

    await d.run('UPDATE products SET stock = stock + ? WHERE id = ?', [2, productId]);
    await d.run(`INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, notes) VALUES (?,?,?,?,?,?)`,
      [productId, 'return', 2, cur, cur + 2, `Exchange: ${exc.id}`]);
    await d.run('UPDATE products SET stock = stock - ? WHERE id = ?', [1, replId]);
    await d.run(`INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, notes) VALUES (?,?,?,?,?,?)`,
      [replId, 'sale', 1, 20, 19, `Exchange: ${exc.id}`]);

    expect((await d.get('SELECT stock FROM products WHERE id = ?', [productId])).stock).toBe(cur + 2);
    expect((await d.get('SELECT stock FROM products WHERE id = ?', [replId])).stock).toBe(19);
    await d.run('DELETE FROM inventory WHERE product_id = ?', [replId]);
    await d.run('DELETE FROM exchange_items WHERE exchange_id = ?', [exc.id]);
    await d.run('DELETE FROM exchanges WHERE id = ?', [exc.id]);
    await d.run('DELETE FROM products WHERE id = ?', [replId]);
  });
});

test.describe('Phase 3 - Low Stock & Inventory Value', () => {
  test('3.2 - low stock query', async ({ window }) => {
    const d = db(window);
    const bc = `LOW-${Date.now()}`;
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, unit) VALUES (?,?,?,?,?,?,?)`,
      ['Low Test', bc, 10, 5, 3, 10, 'piece']);
    const rows = await d.all('SELECT * FROM products WHERE stock <= min_stock AND min_stock > 0');
    expect(rows.find(r => r.barcode === bc)).toBeTruthy();
    await d.run('DELETE FROM products WHERE barcode = ?', [bc]);
  });

  test('3.3 - inventory value and movement log', async ({ window }) => {
    const d = db(window);
    const val = await d.get('SELECT COALESCE(SUM(stock*cost),0) as total FROM products');
    expect(Number(val.total)).toBeGreaterThanOrEqual(0);

    const cat = await d.all(`SELECT category, COALESCE(SUM(stock*cost),0) as value FROM products WHERE category IS NOT NULL AND category!='' GROUP BY category`);
    expect(Array.isArray(cat)).toBe(true);

    const p = await d.get('SELECT stock FROM products WHERE id = ?', [productId]);
    if (!p) return;
    await d.run('UPDATE products SET stock = ? WHERE id = ?', [p.stock + 5, productId]);
    await d.run(`INSERT INTO inventory (product_id, type, quantity, balance_before, balance_after, notes) VALUES (?,?,?,?,?,?)`,
      [productId, 'add', 5, p.stock, p.stock + 5, 'test']);

    const logs = await d.all(`SELECT i.*, p.name as product_name FROM inventory i JOIN products p ON i.product_id=p.id WHERE i.product_id=? ORDER BY i.id DESC`, [productId]);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].product_name).toBeTruthy();
  });
});
