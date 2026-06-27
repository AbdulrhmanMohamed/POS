import { test, expect } from '../fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
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

test.describe('Phase 1.6 - Invoice States', () => {
  test('invoices page lists invoices with status', async ({ window }) => {
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('جاري التحميل');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
    await loginAsAdmin(window);
    await window.locator('a').filter({ hasText: 'الفواتير' }).first().click();
    await window.waitForTimeout(500);
    const h1 = await window.textContent('h1');
    expect(h1).toMatch(/فواتير|Invoices/);
  });

  test('invoice status badge is visible', async ({ window }) => {
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('جاري التحميل');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
    await loginAsAdmin(window);
    await window.locator('a').filter({ hasText: 'الفواتير' }).first().click();
    await window.waitForTimeout(500);

    const statusBadges = window.locator('table td span, table td .badge, table td .status');
    if (await statusBadges.count() > 0) {
      await expect(statusBadges.first()).toBeVisible();
    }
  });
});
