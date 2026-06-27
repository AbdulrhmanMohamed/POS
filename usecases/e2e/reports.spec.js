import { test, expect } from '../../tests/fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('E2E - Reports', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
  });

  test('US-10.1: Daily report KPIs', async () => {
    const d = db(window);
    const ts = Date.now();
    const today = new Date().toISOString().split('T')[0];

    await d.run(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number LIKE ?)`, [`E2E-RPT-KPI-${ts}-%`]);
    await d.run(`DELETE FROM invoices WHERE invoice_number LIKE ?`, [`E2E-RPT-KPI-${ts}-%`]);
    await d.run(`DELETE FROM customers WHERE name = ?`, [`E2E-RPT-CUST-${ts}`]);

    await d.run(`INSERT INTO customers (name) VALUES (?)`, [`E2E-RPT-CUST-${ts}`]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-RPT-CUST-${ts}`]);

    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status, created_at) VALUES (?,?,?,?,?,?,?,?)`,
      [`E2E-RPT-KPI-${ts}-sale`, customer.id, 500, 0, 0, 500, 'paid', today]);
    const saleInvoice = await d.get(`SELECT id FROM invoices WHERE invoice_number = ?`, [`E2E-RPT-KPI-${ts}-sale`]);

    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status, created_at) VALUES (?,?,?,?,?,?,?,?)`,
      [`E2E-RPT-KPI-${ts}-return`, customer.id, -100, 0, 0, -100, 'refunded', today]);
    const returnInvoice = await d.get(`SELECT id FROM invoices WHERE invoice_number = ?`, [`E2E-RPT-KPI-${ts}-return`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['RPT KPI Prod', `E2E-RPT-KPI-PROD-${ts}`, 50, 30, 10, 2, 'TestRpt', 'piece']);
    const product = await d.get(`SELECT id, cost FROM products WHERE barcode = ?`, [`E2E-RPT-KPI-PROD-${ts}`]);

    await d.run(`INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, unit_price, unit_cost, total_price) VALUES (?,?,?,?,?,?,?)`,
      [saleInvoice.id, product.id, 'RPT KPI Prod', 10, 50, Number(product.cost), 500]);

    const dailyProfit = await d.get(
      `SELECT COALESCE(SUM((ii.unit_price - ii.unit_cost) * ii.quantity), 0) as profit
       FROM invoice_items ii
       JOIN invoices inv ON ii.invoice_id = inv.id
       WHERE DATE(inv.created_at) = ? AND inv.status != 'refunded'`, [today]);

    expect(Number(dailyProfit.profit)).toBe((50 - 30) * 10);
  });

  test('US-10.2: Sales over time', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM invoices WHERE invoice_number LIKE ?`, [`E2E-RPT-TREND-${ts}-%`]);
    await d.run(`DELETE FROM customers WHERE name = ?`, [`E2E-RPT-TREND-CUST-${ts}`]);

    await d.run(`INSERT INTO customers (name) VALUES (?)`, [`E2E-RPT-TREND-CUST-${ts}`]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-RPT-TREND-CUST-${ts}`]);

    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status, created_at) VALUES (?,?,?,?,?,?,?,?)`,
      [`E2E-RPT-TREND-${ts}-1`, customer.id, 100, 0, 0, 100, 'paid', '2026-01-01']);
    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status, created_at) VALUES (?,?,?,?,?,?,?,?)`,
      [`E2E-RPT-TREND-${ts}-2`, customer.id, 200, 0, 0, 200, 'paid', '2026-01-02']);
    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status, created_at) VALUES (?,?,?,?,?,?,?,?)`,
      [`E2E-RPT-TREND-${ts}-3`, customer.id, 300, 0, 0, 300, 'paid', '2026-01-03']);

    const trend = await d.all(
      `SELECT DATE(created_at) as date, COUNT(*) as count, SUM(total) as total
       FROM invoices
       WHERE invoice_number LIKE ?
       GROUP BY DATE(created_at)
       ORDER BY date`, [`E2E-RPT-TREND-${ts}-%`]);

    expect(trend.length).toBe(3);
    expect(Number(trend[0].total)).toBe(100);
    expect(Number(trend[2].total)).toBe(300);
  });

  test('US-10.3: Profit trend', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number LIKE ?)`, [`E2E-RPT-PROFIT-${ts}-%`]);
    await d.run(`DELETE FROM invoices WHERE invoice_number LIKE ?`, [`E2E-RPT-PROFIT-${ts}-%`]);
    await d.run(`DELETE FROM customers WHERE name = ?`, [`E2E-RPT-PROFIT-CUST-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-RPT-PROFIT-PROD-${ts}`]);

    await d.run(`INSERT INTO customers (name) VALUES (?)`, [`E2E-RPT-PROFIT-CUST-${ts}`]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-RPT-PROFIT-CUST-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['RPT Profit', `E2E-RPT-PROFIT-PROD-${ts}`, 100, 60, 10, 2, 'TestRpt', 'piece']);
    const product = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-RPT-PROFIT-PROD-${ts}`]);

    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status, created_at) VALUES (?,?,?,?,?,?,?,?)`,
      [`E2E-RPT-PROFIT-${ts}-1`, customer.id, 100, 0, 0, 100, 'paid', '2026-01-01']);
    const inv1 = await d.get(`SELECT id FROM invoices WHERE invoice_number = ?`, [`E2E-RPT-PROFIT-${ts}-1`]);

    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status, created_at) VALUES (?,?,?,?,?,?,?,?)`,
      [`E2E-RPT-PROFIT-${ts}-2`, customer.id, 200, 0, 0, 200, 'paid', '2026-01-02']);
    const inv2 = await d.get(`SELECT id FROM invoices WHERE invoice_number = ?`, [`E2E-RPT-PROFIT-${ts}-2`]);

    await d.run(`INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, unit_price, unit_cost, total_price) VALUES (?,?,?,?,?,?,?)`,
      [inv1.id, product.id, 'RPT Profit', 5, 100, 60, 500]);
    await d.run(`INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, unit_price, unit_cost, total_price) VALUES (?,?,?,?,?,?,?)`,
      [inv2.id, product.id, 'RPT Profit', 3, 100, 60, 300]);

    const profitTrend = await d.all(
      `SELECT DATE(inv.created_at) as date, SUM((ii.unit_price - ii.unit_cost) * ii.quantity) as profit
       FROM invoice_items ii
       JOIN invoices inv ON ii.invoice_id = inv.id
       WHERE inv.invoice_number LIKE ?
       GROUP BY DATE(inv.created_at)
       ORDER BY date`, [`E2E-RPT-PROFIT-${ts}-%`]);

    expect(profitTrend.length).toBe(2);
    expect(Number(profitTrend[0].profit)).toBe((100 - 60) * 5);
    expect(Number(profitTrend[1].profit)).toBe((100 - 60) * 3);
  });

  test('US-10.4: Top products', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE invoice_number LIKE ?)`, [`E2E-RPT-TOP-${ts}-%`]);
    await d.run(`DELETE FROM invoices WHERE invoice_number LIKE ?`, [`E2E-RPT-TOP-${ts}-%`]);
    await d.run(`DELETE FROM customers WHERE name = ?`, [`E2E-RPT-TOP-CUST-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode LIKE ?`, [`E2E-RPT-TOP-${ts}-%`]);

    await d.run(`INSERT INTO customers (name) VALUES (?)`, [`E2E-RPT-TOP-CUST-${ts}`]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-RPT-TOP-CUST-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Top Prod A', `E2E-RPT-TOP-${ts}-A`, 50, 20, 10, 2, 'TestRpt', 'piece']);
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Top Prod B', `E2E-RPT-TOP-${ts}-B`, 30, 10, 10, 2, 'TestRpt', 'piece']);
    const prodA = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-RPT-TOP-${ts}-A`]);
    const prodB = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-RPT-TOP-${ts}-B`]);

    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status) VALUES (?,?,?,?,?,?,?)`,
      [`E2E-RPT-TOP-${ts}-1`, customer.id, 100, 0, 0, 100, 'paid']);
    const inv = await d.get(`SELECT id FROM invoices WHERE invoice_number = ?`, [`E2E-RPT-TOP-${ts}-1`]);

    await d.run(`INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, unit_price, unit_cost, total_price) VALUES (?,?,?,?,?,?,?)`,
      [inv.id, prodA.id, 'Top Prod A', 10, 50, 20, 500]);
    await d.run(`INSERT INTO invoice_items (invoice_id, product_id, product_name, quantity, unit_price, unit_cost, total_price) VALUES (?,?,?,?,?,?,?)`,
      [inv.id, prodB.id, 'Top Prod B', 5, 30, 10, 150]);

    const topProducts = await d.all(
      `SELECT ii.product_id, p.name, SUM(ii.quantity) as total_qty, SUM(ii.total_price) as total_revenue
       FROM invoice_items ii
       JOIN products p ON ii.product_id = p.id
       WHERE p.barcode LIKE ?
       GROUP BY ii.product_id
       ORDER BY total_qty DESC`, [`E2E-RPT-TOP-${ts}-%`]);

    expect(topProducts.length).toBe(2);
    expect(topProducts[0].name).toBe('Top Prod A');
    expect(Number(topProducts[0].total_qty)).toBe(10);
    expect(Number(topProducts[1].total_qty)).toBe(5);
  });

  test('US-10.5: Customer frequency', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM invoices WHERE invoice_number LIKE ?`, [`E2E-RPT-FREQ-${ts}-%`]);
    await d.run(`DELETE FROM customers WHERE name = ?`, [`E2E-RPT-FREQ-CUST-${ts}`]);

    await d.run(`INSERT INTO customers (name) VALUES (?)`, [`E2E-RPT-FREQ-CUST-${ts}`]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-RPT-FREQ-CUST-${ts}`]);

    for (let i = 0; i < 5; i++) {
      await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status) VALUES (?,?,?,?,?,?,?)`,
        [`E2E-RPT-FREQ-${ts}-${i}`, customer.id, 50, 0, 0, 50, 'paid']);
    }

    const freq = await d.get(
      `SELECT customer_id, COUNT(*) as invoice_count
       FROM invoices
       WHERE customer_id = ?
       GROUP BY customer_id`, [customer.id]);

    expect(freq).not.toBeNull();
    expect(Number(freq.invoice_count)).toBe(5);
  });

  test('US-10.6: Date range filter', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM invoices WHERE invoice_number LIKE ?`, [`E2E-RPT-DATE-${ts}-%`]);
    await d.run(`DELETE FROM customers WHERE name = ?`, [`E2E-RPT-DATE-CUST-${ts}`]);

    await d.run(`INSERT INTO customers (name) VALUES (?)`, [`E2E-RPT-DATE-CUST-${ts}`]);
    const customer = await d.get(`SELECT id FROM customers WHERE name = ?`, [`E2E-RPT-DATE-CUST-${ts}`]);

    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status, created_at) VALUES (?,?,?,?,?,?,?,?)`,
      [`E2E-RPT-DATE-${ts}-1`, customer.id, 100, 0, 0, 100, 'paid', '2026-01-01']);
    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status, created_at) VALUES (?,?,?,?,?,?,?,?)`,
      [`E2E-RPT-DATE-${ts}-2`, customer.id, 200, 0, 0, 200, 'paid', '2026-01-15']);
    await d.run(`INSERT INTO invoices (invoice_number, customer_id, subtotal, discount, tax, total, status, created_at) VALUES (?,?,?,?,?,?,?,?)`,
      [`E2E-RPT-DATE-${ts}-3`, customer.id, 300, 0, 0, 300, 'paid', '2026-02-01']);

    const janInvoices = await d.all(
      `SELECT * FROM invoices WHERE invoice_number LIKE ? AND DATE(created_at) >= ? AND DATE(created_at) <= ?`,
      [`E2E-RPT-DATE-${ts}-%`, '2026-01-01', '2026-01-31']);
    expect(janInvoices.length).toBe(2);

    const febInvoices = await d.all(
      `SELECT * FROM invoices WHERE invoice_number LIKE ? AND DATE(created_at) >= ? AND DATE(created_at) <= ?`,
      [`E2E-RPT-DATE-${ts}-%`, '2026-02-01', '2026-02-28']);
    expect(febInvoices.length).toBe(1);
  });

  test('US-10.7: Empty period', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM invoices WHERE invoice_number LIKE ?`, [`E2E-RPT-EMPTY-${ts}-%`]);

    const total = await d.get(
      `SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE invoice_number LIKE ? AND DATE(created_at) = ?`,
      [`E2E-RPT-EMPTY-${ts}-%`, '2025-01-01']);

    expect(total).not.toBeNull();
    expect(Number(total.total)).toBe(0);
  });

  test('US-10.8: Period change aggregates correctly (daily/weekly/monthly)', async () => {
    const d = db(window);
    const ts = Date.now();
    await d.run(`DELETE FROM products WHERE barcode = 'PERIOD-TEST'`);
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock) VALUES (?,?,?,?,?)`,
      ['Period Test', 'PERIOD-TEST', 100, 30, 10]);
    const prod = await d.get(`SELECT id FROM products WHERE barcode = 'PERIOD-TEST'`);
    // Create invoices on different dates within same month
    const firstDay = '2026-05-11';
    const lastDay = '2026-05-25';
    await d.run(`INSERT INTO invoices (invoice_number, total, status, created_at) VALUES (?,?,?,?)`,
      [`PERIOD-INV-A-${ts}`, 100, 'completed', firstDay]);
    const invA = await d.get(`SELECT id FROM invoices WHERE invoice_number = ?`, [`PERIOD-INV-A-${ts}`]);
    await d.run(
      `INSERT INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?,?,?,?,?,?,?,?)`,
      [invA.id, prod.id, 'Period Test', 'PERIOD-TEST', 1, 100, 30, 100]
    );
    await d.run(`INSERT INTO invoices (invoice_number, total, status, created_at) VALUES (?,?,?,?)`,
      [`PERIOD-INV-B-${ts}`, 200, 'completed', lastDay]);
    const invB = await d.get(`SELECT id FROM invoices WHERE invoice_number = ?`, [`PERIOD-INV-B-${ts}`]);
    await d.run(
      `INSERT INTO invoice_items (invoice_id, product_id, product_name, barcode, quantity, unit_price, unit_cost, total_price) VALUES (?,?,?,?,?,?,?,?)`,
      [invB.id, prod.id, 'Period Test', 'PERIOD-TEST', 2, 100, 30, 200]
    );
    // Daily: query specific day
    const dayA = await d.get(
      `SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE DATE(created_at) = ?`, [firstDay]
    );
    expect(Number(dayA.total)).toBe(100);
    // Monthly: query entire month
    const monthTotal = await d.get(
      `SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE created_at >= ? AND created_at < ?`,
      ['2026-05-01', '2026-06-01']
    );
    expect(Number(monthTotal.total)).toBe(300);
    await d.run(`DELETE FROM invoice_items WHERE invoice_id IN (?,?)`, [invA.id, invB.id]);
    await d.run(`DELETE FROM invoices WHERE id IN (?,?)`, [invA.id, invB.id]);
    await d.run(`DELETE FROM products WHERE barcode = 'PERIOD-TEST'`);
  });
});
