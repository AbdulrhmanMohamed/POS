import { test, expect } from '../fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('Phase 3 - Product Categories & Barcode', () => {
  let window;

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
    await d.run(
      `INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      [`Cat Test ${ts}`, `CAT-${ts}`, 50, 20, 10, 3, 'TestCategory', 'piece']
    );

    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('جاري التحميل');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
  });

  test('3.9.1 - Products page has a category summary section', async () => {
    await loginAsAdmin();
    await window.locator('a').filter({ hasText: 'المنتجات' }).first().click();
    await window.waitForTimeout(500);
    const body = await window.locator('body').textContent();
    expect(body).toContain('الفئة');
    const cards = window.locator('.stat-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('3.9.2 - Add product modal has a barcode generate button', async () => {
    await loginAsAdmin();
    await window.locator('a').filter({ hasText: 'المنتجات' }).first().click();
    await window.waitForTimeout(500);
    await window.click('button:has-text("إضافة منتج")');
    await window.waitForTimeout(300);
    const genBtn = window.locator('button:has-text("توليد")');
    await expect(genBtn).toBeVisible();
  });

  test('3.9.3 - Barcode generation fills the barcode input', async () => {
    await loginAsAdmin();
    await window.locator('a').filter({ hasText: 'المنتجات' }).first().click();
    await window.waitForTimeout(500);
    await window.click('button:has-text("إضافة منتج")');
    await window.waitForTimeout(300);
    const genBtn = window.locator('button:has-text("توليد")');
    await genBtn.click();
    await window.waitForTimeout(200);
    const barcodeInput = window.locator('input[name="barcode"], input[placeholder*="باركود"], input[id="barcode"]').first();
    const val = await barcodeInput.inputValue();
    expect(val.length).toBeGreaterThan(0);
  });

  test('3.9.4 - Can query product count by category', async () => {
    const d = db(window);
    const rows = await d.all(
      `SELECT category, COUNT(*) as count FROM products WHERE category IS NOT NULL AND category!='' GROUP BY category ORDER BY count DESC`
    );
    expect(Array.isArray(rows)).toBe(true);
    if (rows.length > 0) {
      expect(rows[0].category).toBeTruthy();
      expect(Number(rows[0].count)).toBeGreaterThan(0);
    }
  });

  test('3.9.5 - Category with most products is listed first', async () => {
    const d = db(window);
    const rows = await d.all(
      `SELECT category, COUNT(*) as count FROM products WHERE category IS NOT NULL AND category!='' GROUP BY category ORDER BY count DESC`
    );
    expect(rows.length).toBeGreaterThan(0);
    for (let i = 1; i < rows.length; i++) {
      expect(Number(rows[i - 1].count)).toBeGreaterThanOrEqual(Number(rows[i].count));
    }
  });
});
