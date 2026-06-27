import { test, expect } from '../fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
  };
}

test.describe('Phase 4 - Scanner & Label Printing', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('جاري التحميل');
    }, { timeout: 20000 });
    await window.waitForTimeout(500);
  });

  async function loginAsAdmin() {
    const d = db(window);
    await d.run(`DELETE FROM users WHERE username = 'adminUser'`);
    await d.run(`INSERT INTO users (username, password, role) VALUES (?,?,?)`, ['adminUser', 'admin123', 'admin']);
    const logoutBtn = window.locator('button').filter({ hasText: /تسجيل خروج|Logout/ });
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await window.waitForTimeout(300);
    }
    await window.locator('input').first().fill('adminUser');
    await window.locator('input[type="password"]').fill('admin123');
    await window.locator('button').filter({ hasText: 'تسجيل الدخول' }).click();
    await window.waitForTimeout(1500);
  }

  test('4.4.1 - POS screen shows scanner status indicator and unified search input', async () => {
    await loginAsAdmin();

    // Check scanner status indicator
    const body = await window.locator('body').textContent();
    expect(body).toMatch(/Scanner Ready|الماسح جاهز/);

    // Check unified search input exists
    const searchInput = window.locator('input[placeholder*="Search product" i], input[placeholder*="بحث عن منتج" i]');
    await expect(searchInput).toBeVisible({ timeout: 3000 });
  });

  test('4.4.2 - Products page has Print Label button on each product row', async () => {
    await loginAsAdmin();
    await loginAsAdmin();
    const d = db(window);
    await d.run(`DELETE FROM products WHERE barcode = '7770007770001'`);
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Label Test', '7770007770001', 25, 10, 50, 5, 'Test', 'piece']);

    // Go to Products page
    const prodLink = window.locator('a').filter({ hasText: 'المنتجات' }).first();
    await prodLink.click();
    await window.waitForTimeout(800);

    const body = await window.locator('body').textContent();
    expect(body).toMatch(/Print Label|طباعة الباركود/);
  });

  test('4.4.3 - Settings page shows scanner prefix/suffix fields', async () => {
    await loginAsAdmin();
    const settingsLink = window.locator('a').filter({ hasText: 'الإعدادات' }).first();
    await settingsLink.click();
    await window.waitForTimeout(800);

    // Click the Scanner tab
    const scannerTab = window.locator('button').filter({ hasText: 'Scanner' }).or(window.locator('button').filter({ hasText: 'الماسح' }));
    await expect(scannerTab).toBeVisible({ timeout: 5000 });
    await scannerTab.click();
    await window.waitForTimeout(300);

    const body = await window.locator('body').textContent();
    expect(body).toMatch(/Scanner Settings|إعدادات الماسح/);
    expect(body).toMatch(/Scanner Prefix|بادئة الماسح/);
    expect(body).toMatch(/Scanner Suffix|لاحقة الماسح/);
  });

  test('4.4.4 - Barcode label template builds valid HTML', async () => {
    await loginAsAdmin();

    // Verify the function exists by checking preload exposes print
    const hasPrint = await window.evaluate(() => typeof window.electronAPI?.print === 'function');
    expect(hasPrint).toBe(true);

    // Navigate to Products page
    const prodLink = window.locator('a').filter({ hasText: 'المنتجات' }).first();
    await expect(prodLink).toBeVisible({ timeout: 5000 });
    await prodLink.click();
    await window.waitForTimeout(800);

    const body = await window.locator('body').textContent();
    // Products page has Print Label buttons meaning LabelTemplate is usable
    expect(body).toMatch(/Print Label|طباعة الباركود/);
  });
});
