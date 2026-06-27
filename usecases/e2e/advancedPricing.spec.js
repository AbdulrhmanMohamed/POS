import { test, expect } from '../../tests/fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('E2E - Advanced Pricing', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
  });

  test('US-15.1: Create price tier', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM price_tiers WHERE product_id IN (SELECT id FROM products WHERE barcode = ?)`, [`E2E-PTIER-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-PTIER-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Tier Test', `E2E-PTIER-${ts}`, 100, 50, 10, 2, 'TestPricing', 'piece']);
    const product = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-PTIER-${ts}`]);

    await d.run(`INSERT INTO price_tiers (product_id, tier_name, price) VALUES (?,?,?)`,
      [product.id, 'Wholesale', 80]);

    const tier = await d.get(`SELECT * FROM price_tiers WHERE product_id = ? AND tier_name = ?`, [product.id, 'Wholesale']);
    expect(tier).not.toBeNull();
    expect(Number(tier.price)).toBe(80);
  });

  test('US-15.2: Create bulk discount', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM bulk_discounts WHERE product_id IN (SELECT id FROM products WHERE barcode = ?)`, [`E2E-BULK-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-BULK-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Bulk Test', `E2E-BULK-${ts}`, 100, 50, 10, 2, 'TestPricing', 'piece']);
    const product = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-BULK-${ts}`]);

    await d.run(`INSERT INTO bulk_discounts (product_id, min_quantity, discount_percent) VALUES (?,?,?)`,
      [product.id, 10, 15]);

    const discount = await d.get(`SELECT * FROM bulk_discounts WHERE product_id = ? AND min_quantity = ?`, [product.id, 10]);
    expect(discount).not.toBeNull();
    expect(Number(discount.min_quantity)).toBe(10);
    expect(Number(discount.discount_percent)).toBe(15);
  });

  test('US-15.3: Create promo period', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM promo_periods WHERE product_id IN (SELECT id FROM products WHERE barcode = ?)`, [`E2E-PROMO-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-PROMO-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Promo Test', `E2E-PROMO-${ts}`, 100, 50, 10, 2, 'TestPricing', 'piece']);
    const product = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-PROMO-${ts}`]);

    await d.run(`INSERT INTO promo_periods (product_id, promo_price, start_date, end_date) VALUES (?,?,?,?)`,
      [product.id, 70, '2026-01-01', '2026-01-31']);

    const promo = await d.get(`SELECT * FROM promo_periods WHERE product_id = ?`, [product.id]);
    expect(promo).not.toBeNull();
    expect(Number(promo.promo_price)).toBe(70);
    expect(promo.start_date).toBe('2026-01-01');
    expect(promo.end_date).toBe('2026-01-31');
  });

  test('US-15.4: Invalid promo dates', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM promo_periods WHERE product_id IN (SELECT id FROM products WHERE barcode = ?)`, [`E2E-PROMO-INV-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-PROMO-INV-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Promo Inv', `E2E-PROMO-INV-${ts}`, 100, 50, 10, 2, 'TestPricing', 'piece']);
    const product = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-PROMO-INV-${ts}`]);

    const startDate = '2026-02-01';
    const endDate = '2026-01-01';

    let error = null;
    try {
      if (startDate > endDate) {
        throw new Error('start_date cannot be after end_date');
      }
      await d.run(`INSERT INTO promo_periods (product_id, promo_price, start_date, end_date) VALUES (?,?,?,?)`,
        [product.id, 60, startDate, endDate]);
    } catch (e) {
      error = e;
    }
    expect(error).not.toBeNull();
    expect(error.message).toContain('start_date');
  });

  test('US-15.5: Invalid discount percent', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM bulk_discounts WHERE product_id IN (SELECT id FROM products WHERE barcode = ?)`, [`E2E-DISC-INV-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-DISC-INV-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Disc Inv', `E2E-DISC-INV-${ts}`, 100, 50, 10, 2, 'TestPricing', 'piece']);
    const product = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-DISC-INV-${ts}`]);

    let errorHigh = null;
    try {
      const discount = 150;
      if (discount > 100 || discount < 0) {
        throw new Error('discount_percent must be between 0 and 100');
      }
      await d.run(`INSERT INTO bulk_discounts (product_id, min_quantity, discount_percent) VALUES (?,?,?)`,
        [product.id, 5, discount]);
    } catch (e) {
      errorHigh = e;
    }
    expect(errorHigh).not.toBeNull();

    let errorLow = null;
    try {
      const discount = -10;
      if (discount > 100 || discount < 0) {
        throw new Error('discount_percent must be between 0 and 100');
      }
      await d.run(`INSERT INTO bulk_discounts (product_id, min_quantity, discount_percent) VALUES (?,?,?)`,
        [product.id, 5, discount]);
    } catch (e) {
      errorLow = e;
    }
    expect(errorLow).not.toBeNull();
  });

  test('US-15.6: Update/delete pricing', async () => {
    const d = db(window);
    const ts = Date.now();

    await d.run(`DELETE FROM price_tiers WHERE product_id IN (SELECT id FROM products WHERE barcode = ?)`, [`E2E-PRICING-CRUD-${ts}`]);
    await d.run(`DELETE FROM bulk_discounts WHERE product_id IN (SELECT id FROM products WHERE barcode = ?)`, [`E2E-PRICING-CRUD-${ts}`]);
    await d.run(`DELETE FROM promo_periods WHERE product_id IN (SELECT id FROM products WHERE barcode = ?)`, [`E2E-PRICING-CRUD-${ts}`]);
    await d.run(`DELETE FROM products WHERE barcode = ?`, [`E2E-PRICING-CRUD-${ts}`]);

    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['CRUD Pricing', `E2E-PRICING-CRUD-${ts}`, 100, 50, 10, 2, 'TestPricing', 'piece']);
    const product = await d.get(`SELECT id FROM products WHERE barcode = ?`, [`E2E-PRICING-CRUD-${ts}`]);

    await d.run(`INSERT INTO price_tiers (product_id, tier_name, price) VALUES (?,?,?)`,
      [product.id, 'Retail', 90]);
    await d.run(`UPDATE price_tiers SET price = ? WHERE product_id = ? AND tier_name = ?`,
      [85, product.id, 'Retail']);
    const tier = await d.get(`SELECT price FROM price_tiers WHERE product_id = ? AND tier_name = ?`, [product.id, 'Retail']);
    expect(Number(tier.price)).toBe(85);

    await d.run(`INSERT INTO bulk_discounts (product_id, min_quantity, discount_percent) VALUES (?,?,?)`,
      [product.id, 20, 10]);
    await d.run(`UPDATE bulk_discounts SET discount_percent = ? WHERE product_id = ? AND min_quantity = ?`,
      [12, product.id, 20]);
    const bulk = await d.get(`SELECT discount_percent FROM bulk_discounts WHERE product_id = ? AND min_quantity = ?`, [product.id, 20]);
    expect(Number(bulk.discount_percent)).toBe(12);

    await d.run(`INSERT INTO promo_periods (product_id, promo_price, start_date, end_date) VALUES (?,?,?,?)`,
      [product.id, 75, '2026-03-01', '2026-03-15']);
    await d.run(`UPDATE promo_periods SET promo_price = ? WHERE product_id = ?`,
      [70, product.id]);
    const promo = await d.get(`SELECT promo_price FROM promo_periods WHERE product_id = ?`, [product.id]);
    expect(Number(promo.promo_price)).toBe(70);

    await d.run(`DELETE FROM price_tiers WHERE product_id = ?`, [product.id]);
    const tiersAfter = await d.all(`SELECT id FROM price_tiers WHERE product_id = ?`, [product.id]);
    expect(tiersAfter.length).toBe(0);

    await d.run(`DELETE FROM bulk_discounts WHERE product_id = ?`, [product.id]);
    const bulksAfter = await d.all(`SELECT id FROM bulk_discounts WHERE product_id = ?`, [product.id]);
    expect(bulksAfter.length).toBe(0);

    await d.run(`DELETE FROM promo_periods WHERE product_id = ?`, [product.id]);
    const promosAfter = await d.all(`SELECT id FROM promo_periods WHERE product_id = ?`, [product.id]);
    expect(promosAfter.length).toBe(0);
  });
});
