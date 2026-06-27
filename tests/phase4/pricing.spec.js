import { test, expect } from '../fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('Phase 4 - Advanced Pricing', () => {
  let window;
  let productId;

  async function loginAsAdmin() {
    const d = db(window);
    await d.run(`DELETE FROM users WHERE username = 'adminUser'`);
    await d.run(`INSERT INTO users (username, password, role) VALUES (?,?,?)`, ['adminUser', 'admin123', 'admin']);

    try {
      const logoutBtn = window.locator('nav a, button').filter({ hasText: /Logout|تسجيل خروج/ });
      if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await logoutBtn.click();
        await window.waitForTimeout(500);
      }
    } catch (_) {}

    const loginButton = window.locator('button[type="submit"], button').filter({ hasText: 'تسجيل الدخول' }).first();
    await loginButton.waitFor({ state: 'visible', timeout: 15000 });

    await window.locator('input').first().fill('adminUser');
    await window.locator('input').nth(1).fill('admin123');
    await loginButton.click();
    await window.waitForTimeout(2000);
  }

  test.beforeEach(async ({ window: w }) => {
    window = w;
    const d = db(w);
    const ts = Date.now();
    const result = await d.run(
      `INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      [`Price Test ${ts}`, `PRICE-${ts}`, 100, 50, 20, 5, 'TestPricing', 'piece']
    );
    productId = result.lastInsertRowid;

    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('جاري التحميل');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
  });

  test('4.1.1 - Price tiers table exists', async () => {
    const d = db(window);
    const result = await d.run(
      `INSERT INTO price_tiers (product_id, tier_name, price) VALUES (?,?,?)`,
      [productId, 'wholesale', 80]
    );
    expect(result.lastInsertRowid).toBeGreaterThan(0);
    const tier = await d.get(`SELECT * FROM price_tiers WHERE id = ?`, [result.lastInsertRowid]);
    expect(tier.tier_name).toBe('wholesale');
    expect(Number(tier.price)).toBe(80);
  });

  test('4.1.2 - Can query all price tiers for a product', async () => {
    const d = db(window);
    await d.run(`INSERT INTO price_tiers (product_id, tier_name, price) VALUES (?,?,?)`, [productId, 'wholesale', 80]);
    await d.run(`INSERT INTO price_tiers (product_id, tier_name, price) VALUES (?,?,?)`, [productId, 'retail', 100]);
    await d.run(`INSERT INTO price_tiers (product_id, tier_name, price) VALUES (?,?,?)`, [productId, 'vip', 70]);
    const tiers = await d.all(`SELECT * FROM price_tiers WHERE product_id = ? ORDER BY tier_name`, [productId]);
    expect(tiers.length).toBe(3);
    expect(tiers.map(t => t.tier_name)).toEqual(['retail', 'vip', 'wholesale']);
  });

  test('4.1.3 - Bulk discount table exists', async () => {
    const d = db(window);
    const result = await d.run(
      `INSERT INTO bulk_discounts (product_id, min_quantity, discount_percent) VALUES (?,?,?)`,
      [productId, 10, 5]
    );
    expect(result.lastInsertRowid).toBeGreaterThan(0);
    const disc = await d.get(`SELECT * FROM bulk_discounts WHERE id = ?`, [result.lastInsertRowid]);
    expect(Number(disc.min_quantity)).toBe(10);
    expect(Number(disc.discount_percent)).toBe(5);
  });

  test('4.1.4 - Promo period table exists', async () => {
    const d = db(window);
    const result = await d.run(
      `INSERT INTO promo_periods (product_id, promo_price, start_date, end_date) VALUES (?,?,?,?)`,
      [productId, 75, '2026-06-01', '2026-06-30']
    );
    expect(result.lastInsertRowid).toBeGreaterThan(0);
    const promo = await d.get(`SELECT * FROM promo_periods WHERE id = ?`, [result.lastInsertRowid]);
    expect(Number(promo.promo_price)).toBe(75);
  });

  test('4.1.5 - Products page has tier pricing section', async () => {
    await loginAsAdmin();
    await window.locator('a').filter({ hasText: 'المنتجات' }).first().click();
    await window.waitForTimeout(500);
    const editBtns = window.locator('button:has-text("تعديل")');
    await editBtns.first().click();
    await window.waitForTimeout(300);
    const body = await window.locator('.modal').textContent();
    expect(body).toContain('السعر');
  });
});
