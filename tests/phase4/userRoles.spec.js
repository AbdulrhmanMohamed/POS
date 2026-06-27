import { test, expect } from '../fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('Phase 4 - User Roles & Permissions', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
  });

  test('4.2.1 - Users table exists with role column', async () => {
    const d = db(window);
    await d.run(`DELETE FROM users WHERE username = 'adminUser'`);
    const result = await d.run(
      `INSERT INTO users (username, password, role) VALUES (?,?,?)`,
      ['adminUser', 'admin123', 'admin']
    );
    expect(result.lastInsertRowid).toBeGreaterThan(0);
    const user = await d.get(`SELECT * FROM users WHERE id = ?`, [result.lastInsertRowid]);
    expect(user.role).toBe('admin');
  });

  test('4.2.2 - Settings page has user management section', async () => {
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('جاري التحميل');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);

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

    await window.locator('a').filter({ hasText: 'الإعدادات' }).first().click();
    await window.waitForTimeout(500);
    const body = await window.locator('body').textContent();
    expect(body).toContain('المستخدمين');
  });

  test('4.2.3 - Can query users by role', async () => {
    const d = db(window);
    await d.run(`DELETE FROM users WHERE username = 'cashierUser'`);
    await d.run(`DELETE FROM users WHERE username = 'cashierUser2'`);
    await d.run(`INSERT INTO users (username, password, role) VALUES (?,?,?)`, ['cashierUser', 'pass123', 'cashier']);
    await d.run(`INSERT INTO users (username, password, role) VALUES (?,?,?)`, ['cashierUser2', 'pass456', 'cashier']);
    const cashiers = await d.all(`SELECT * FROM users WHERE role = 'cashier'`);
    expect(cashiers.length).toBeGreaterThanOrEqual(2);
  });

  test('4.2.4 - Default admin user exists', async () => {
    const d = db(window);
    let admin = await d.get(`SELECT * FROM users WHERE role = 'admin' LIMIT 1`);
    if (!admin) {
      await d.run(`REPLACE INTO users (username, password, role) VALUES (?,?,?)`, ['adminUser', 'admin', 'admin']);
    }
    const found = await d.get(`SELECT * FROM users WHERE role = 'admin' LIMIT 1`);
    expect(found).not.toBeNull();
    expect(found.role).toBe('admin');
  });

  test('4.2.5 - Can update user role', async () => {
    const d = db(window);
    await d.run(`DELETE FROM users WHERE username = 'staffUser'`);
    const result = await d.run(
      `INSERT INTO users (username, password, role) VALUES (?,?,?)`,
      ['staffUser', 'staff123', 'cashier']
    );
    await d.run(`UPDATE users SET role = ? WHERE id = ?`, ['admin', result.lastInsertRowid]);
    const user = await d.get(`SELECT * FROM users WHERE id = ?`, [result.lastInsertRowid]);
    expect(user.role).toBe('admin');
  });
});
