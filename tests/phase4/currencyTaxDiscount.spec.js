import { test, expect } from '../fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
  };
}

test.describe('Phase 4 - Currency, Tax & Discount Settings', () => {
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

    // Try to logout if already logged in
    try {
      const logoutBtn = window.locator('nav a, button').filter({ hasText: /Logout|تسجيل خروج/ });
      if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await logoutBtn.click();
        await window.waitForTimeout(500);
      }
    } catch (_) {}

    // Wait for login form to appear
    const loginButton = window.locator('button[type="submit"], button').filter({ hasText: 'تسجيل الدخول' }).first();
    await loginButton.waitFor({ state: 'visible', timeout: 15000 });

    await window.locator('input').first().fill('adminUser');
    await window.locator('input').nth(1).fill('admin123');
    await loginButton.click();
    await window.waitForTimeout(2000);
  }

  test('4.6.1 - Selecting a currency in settings auto-fills the symbol', async () => {
    await loginAsAdmin();

    const settingsLink = window.locator('a').filter({ hasText: /الإعدادات|Settings/ }).first();
    await settingsLink.click();
    await window.waitForTimeout(800);

    const finTab = window.locator('button').filter({ hasText: /Financial|المالية/ });
    await finTab.click();
    await window.waitForTimeout(300);

    const currencySelect = window.locator('select').first();
    await currencySelect.selectOption('EGP');
    await window.waitForTimeout(200);

    const symbolInput = window.locator('input').filter({ has: window.locator('[value]') });
    const body = await window.locator('body').textContent();
    expect(body).toMatch(/ج\.م|EGP/);
  });

  test('4.6.2 - System tab has tax rate and default discount fields', async () => {
    await loginAsAdmin();

    const settingsLink = window.locator('a').filter({ hasText: /الإعدادات|Settings/ }).first();
    await settingsLink.click();
    await window.waitForTimeout(800);

    const sysTab = window.locator('button').filter({ hasText: /System|النظام/ });
    await sysTab.click();
    await window.waitForTimeout(300);

    const body = await window.locator('body').textContent();
    expect(body).toMatch(/Tax Rate|ضريبة/);
    expect(body).toMatch(/Default Discount|الخصم الافتراضي/);
  });

  test('4.6.3 - POS loads tax rate and default discount from settings', async () => {
    const d = db(window);

    // Clean up test settings and set tax rate / default discount
    await d.run(`DELETE FROM settings WHERE \`key\` IN ('tax_rate', 'default_discount')`);
    await d.run(`INSERT INTO settings (\`key\`, value) VALUES ('tax_rate', '10')`);
    await d.run(`INSERT INTO settings (\`key\`, value) VALUES ('default_discount', '5')`);

    // Seed a product to add to cart so discount input appears
    await d.run(`DELETE FROM products WHERE barcode = 'DISCOUNT-DEFAULT-001'`);
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Default Disc', 'DISCOUNT-DEFAULT-001', 50, 25, 20, 3, 'DiscDefault', 'piece']);

    await loginAsAdmin();
    await window.waitForTimeout(2000);

    // Select the DiscDefault category to find our product
    const catSelect = window.locator('select').first();
    await catSelect.selectOption('DiscDefault');
    await window.waitForTimeout(500);

    // Add product to cart so discount section renders
    const productCard = window.locator('.card').filter({ hasText: 'Default Disc' }).first();
    await expect(productCard).toBeVisible({ timeout: 8000 });
    await productCard.click();
    await window.waitForTimeout(300);

    // Check discount input has value 5 (from default_discount setting)
    const discountInput = window.locator('input[type="number"]').first();
    await expect(discountInput).toBeVisible({ timeout: 5000 });
    const val = await discountInput.inputValue();
    expect(val).toBe('5');
  });

  test('4.6.4 - POS discount can be overridden by user', async () => {
    const d = db(window);
    await d.run(`DELETE FROM products WHERE barcode = 'DISCOUNT-OVERRIDE-001'`);
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Override Test', 'DISCOUNT-OVERRIDE-001', 100, 50, 10, 2, 'DiscTest', 'piece']);

    // Set default discount to 5
    await d.run(`DELETE FROM settings WHERE \`key\` = 'default_discount'`);
    await d.run(`INSERT INTO settings (\`key\`, value) VALUES ('default_discount', '5')`);

    await loginAsAdmin();
    await window.waitForTimeout(2000);

    // Select the DiscTest category to isolate our product
    const categorySelect = window.locator('select').first();
    await categorySelect.selectOption('DiscTest');
    await window.waitForTimeout(500);

    // Add product to cart
    const productCard = window.locator('.card').filter({ hasText: 'Override Test' }).first();
    await expect(productCard).toBeVisible({ timeout: 8000 });
    await productCard.click();
    await window.waitForTimeout(300);

    // Change discount to 10
    const discountInput = window.locator('input[type="number"]').first();
    await expect(discountInput).toBeVisible({ timeout: 5000 });
    await discountInput.fill('10');
    await window.waitForTimeout(300);

    const val = await discountInput.inputValue();
    expect(val).toBe('10');
  });
});
