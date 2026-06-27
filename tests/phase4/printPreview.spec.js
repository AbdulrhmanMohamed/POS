import { test, expect } from '../fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
  };
}

test.describe('Phase 4 - Print Preview & Label Improvements', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('جاري التحميل');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
  });

  async function loginAsAdmin() {
    const d = db(window);
    await d.run(`DELETE FROM users WHERE username = 'adminUser'`);
    await d.run(`INSERT INTO users (username, password, role) VALUES (?,?,?)`, ['adminUser', 'admin123', 'admin']);

    const logoutBtn = window.locator('nav a, button').filter({ hasText: /Logout|تسجيل خروج/ });
    if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await logoutBtn.click();
      await window.waitForTimeout(500);
    }

    const loginButton = window.locator('button[type="submit"], button').filter({ hasText: 'تسجيل الدخول' }).first();
    await loginButton.waitFor({ state: 'visible', timeout: 15000 });

    await window.locator('input').first().fill('adminUser');
    await window.locator('input').nth(1).fill('admin123');
    await loginButton.click();
    await window.waitForTimeout(2000);
  }

  test('4.7.1 - Print label button opens preview modal with scannable barcode SVG', async () => {
    await loginAsAdmin();

    await window.locator('a').filter({ hasText: 'المنتجات' }).first().click();
    await window.waitForTimeout(500);

    const printBtn = window.locator('button').filter({ hasText: 'طباعة الباركود' }).first();
    await expect(printBtn).toBeVisible({ timeout: 5000 });
    await printBtn.click();
    await window.waitForTimeout(500);

    const modal = window.locator('.modal-overlay');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const iframe = modal.locator('iframe');
    await expect(iframe).toBeVisible({ timeout: 3000 });

    const srcDoc = await iframe.getAttribute('srcdoc');
    expect(srcDoc).toContain('<svg');
    expect(srcDoc).toContain('<rect');
    expect(srcDoc).toContain('width="3"');
    expect(srcDoc).toContain('height="50"');
  });

  test('4.7.2 - Print preview modal has طباعة and إلغاء buttons', async () => {
    const d = db(window);
    await d.run(`DELETE FROM products WHERE barcode = 'PREVIEW-TEST-002'`);
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Preview Test 2', 'PREVIEW-TEST-002', 25, 10, 40, 3, 'PreviewTest', 'piece']);

    await loginAsAdmin();

    await window.locator('a').filter({ hasText: 'المنتجات' }).first().click();
    await window.waitForTimeout(500);

    const printBtn = window.locator('button').filter({ hasText: 'طباعة الباركود' }).first();
    await expect(printBtn).toBeVisible({ timeout: 5000 });
    await printBtn.click();
    await window.waitForTimeout(500);

    const modal = window.locator('.modal-overlay');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const printActionBtn = window.locator('.modal-overlay button').filter({ hasText: 'طباعة' }).first();
    await expect(printActionBtn).toBeVisible();

    const cancelBtn = window.locator('.modal-overlay button').filter({ hasText: 'إلغاء' }).first();
    await expect(cancelBtn).toBeVisible();

    await cancelBtn.click();
    await window.waitForTimeout(300);
    await expect(modal).not.toBeVisible();
  });
});
