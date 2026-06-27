import { test, expect } from './fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
  };
}

async function loginAsAdmin(window) {
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

test.describe('POS App - Smoke Tests', () => {
  test('app launches and shows the POS screen', async ({ window }) => {
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('جاري التحميل');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
    await loginAsAdmin(window);
    await expect(window).toHaveTitle(/POS|نقاط البيع/);
    const title = await window.textContent('h1');
    expect(title).toBeTruthy();
  });

  test('navigates to all main pages', async ({ window }) => {
    const pages = [
      { nav: 'المنتجات', expected: /منتجات|Products/ },
      { nav: 'العملاء', expected: /عملاء|Customers/ },
      { nav: 'الموردين', expected: /موردون|Suppliers/ },
      { nav: 'الفواتير', expected: /فواتير|Invoices/ },
      { nav: 'المرتجعات', expected: /مرتجعات|Returns/ },
      { nav: 'المخزون', expected: /مخزون|Inventory/ },
      { nav: 'التقارير', expected: /تقارير|Reports/ },
      { nav: 'الإعدادات', expected: /إعدادات|Settings/ },
      { nav: 'سجل التدقيق', expected: /تدقيق|Audit/ },
    ];

    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('جاري التحميل');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
    await loginAsAdmin(window);

    for (const { nav, expected } of pages) {
      await window.locator('a').filter({ hasText: nav }).first().click();
      await window.waitForTimeout(300);
      const h1 = await window.textContent('h1');
      expect(h1).toMatch(expected);
    }
  });

  test('sidebar navigation is visible', async ({ window }) => {
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('جاري التحميل');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
    await loginAsAdmin(window);

    const sidebarLinks = [
      'البيع', 'المنتجات', 'العملاء', 'الموردين',
      'المخزون', 'التقارير', 'الإعدادات',
    ];
    for (const link of sidebarLinks) {
      await expect(window.locator('a').filter({ hasText: link }).first()).toBeVisible();
    }
  });
});
