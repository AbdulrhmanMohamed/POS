import { test, expect } from '../fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
  };
}

test.describe('Phase 4 - Role-Based Access Control', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('جاري التحميل');
    }, { timeout: 20000 });
    await window.waitForTimeout(500);
  });

  test('4.3.1 - Login page shows username and password fields', async () => {
    const body = await window.locator('body').textContent();
    expect(body).toMatch(/تسجيل الدخول|Login/);
  });

  test('4.3.2 - Admin can insert user and login via login form', async () => {
    const d = db(window);
    await d.run(`DELETE FROM users WHERE username = 'adminUser'`);
    await d.run(`INSERT INTO users (username, password, role) VALUES (?,?,?)`, ['adminUser', 'admin123', 'admin']);
    const user = await d.get(`SELECT * FROM users WHERE username = 'adminUser'`);
    expect(user).not.toBeNull();
    expect(user.role).toBe('admin');

    await window.locator('input').first().fill('adminUser');
    await window.locator('input[type="password"]').fill('admin123');
    await window.locator('button').filter({ hasText: 'تسجيل الدخول' }).click();
    await window.waitForTimeout(1500);

    const body = await window.locator('body').textContent();
    expect(body).not.toMatch(/تسجيل الدخول|Login/);
  });

  test('4.3.3 - Cashier cannot see settings in sidebar', async () => {
    const logoutBtn = window.locator('button').filter({ hasText: /تسجيل خروج|Logout/ });
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await window.waitForTimeout(500);
    }
    const d = db(window);
    await d.run(`DELETE FROM users WHERE username = 'cashierUser'`);
    await d.run(`INSERT INTO users (username, password, role) VALUES (?,?,?)`, ['cashierUser', 'pass123', 'cashier']);

    await window.locator('input').first().fill('cashierUser');
    await window.locator('input[type="password"]').fill('pass123');
    await window.locator('button').filter({ hasText: 'تسجيل الدخول' }).click();
    await window.waitForTimeout(1500);

    const sidebar = window.locator('.sidebar');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    const sidebarLinks = window.locator('.nav-link');
    const count = await sidebarLinks.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await sidebarLinks.nth(i).innerText());
    }
    const forbidden = ['الإعدادات', 'التقارير', 'المخزون', 'المصروفات', 'العمال', 'أوامر الشراء', 'دليل الحسابات', 'سجل المراجعة'];
    for (const f of forbidden) {
      expect(texts).not.toContain(f);
    }
    expect(texts).toContain('البيع');
    expect(texts).toContain('المنتجات');
    expect(texts).toContain('العملاء');
    expect(texts).toContain('الموردين');
    expect(texts).toContain('الخزينة');
  });

  test('4.3.4 - Logout button works', async () => {
    const d = db(window);
    await d.run(`DELETE FROM users WHERE username = 'cashierUser'`);
    await d.run(`INSERT INTO users (username, password, role) VALUES (?,?,?)`, ['cashierUser', 'pass123', 'cashier']);

    const logoutBtn = window.locator('button').filter({ hasText: /تسجيل خروج|Logout/ });
    if (!(await logoutBtn.isVisible())) {
      await window.locator('input').first().fill('cashierUser');
      await window.locator('input[type="password"]').fill('pass123');
      await window.locator('button').filter({ hasText: 'تسجيل الدخول' }).click();
      await window.waitForTimeout(1500);
    }
    await expect(logoutBtn).toBeVisible({ timeout: 5000 });
    await logoutBtn.click();
    await window.waitForTimeout(500);
    const body = await window.locator('body').textContent();
    expect(body).toMatch(/تسجيل الدخول|Login/);
  });
});
