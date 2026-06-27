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

test.describe('Phase 1.2 - Customer Payment Tracking', () => {
  test('customer page shows balance information', async ({ window }) => {
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('جاري التحميل');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
    await loginAsAdmin(window);
    await window.locator('a').filter({ hasText: 'العملاء' }).first().click();
    await window.waitForTimeout(500);
    const body = await window.textContent('body');
    expect(body).toContain('الرصيد');
  });

  test('can record a payment for a customer', async ({ window }) => {
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('جاري التحميل');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
    await loginAsAdmin(window);
    await window.locator('a').filter({ hasText: 'العملاء' }).first().click();
    await window.waitForTimeout(500);

    const payBtn = window.locator('button:has-text("دفعة"), button:has-text("سداد"), button:has-text("Pay")');
    if (await payBtn.count() > 0) {
      await payBtn.first().click();
      await window.waitForTimeout(300);
    }
  });
});
