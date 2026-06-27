import { test, expect } from '../../tests/fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

async function loginAs(window, username, password) {
  const body = await window.locator('body').textContent();
  if (body.includes('تسجيل الخروج') || body.includes('Logout')) {
    await window.locator('button').filter({ hasText: /تسجيل خروج|Logout/ }).click();
    await window.waitForTimeout(500);
  }
  await window.locator('input').first().fill(username);
  await window.locator('input[type="password"]').fill(password);
  await window.locator('button').filter({ hasText: 'تسجيل الدخول' }).click();
  await window.waitForTimeout(1500);
}

test.describe('E2E - Users & RBAC', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0645\u064A\u0644');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
  });

  test('US-13.1: Create user', async () => {
    const d = db(window);
    const ts = Date.now();
    const username = `E2E-USER-${ts}`;

    await d.run(`DELETE FROM users WHERE username = ?`, [username]);

    await d.run(`INSERT INTO users (username, password, role) VALUES (?,?,?)`,
      [username, 'pass123', 'cashier']);

    const user = await d.get(`SELECT * FROM users WHERE username = ?`, [username]);
    expect(user).not.toBeNull();
    expect(user.role).toBe('cashier');
  });

  test('US-13.2: Login', async () => {
    const d = db(window);
    const ts = Date.now();
    const username = `E2E-LOGIN-${ts}`;

    await d.run(`DELETE FROM users WHERE username = ?`, [username]);
    await d.run(`INSERT INTO users (username, password, role) VALUES (?,?,?)`,
      [username, 'test123', 'admin']);

    await loginAs(window, username, 'test123');

    const body = await window.locator('body').textContent();
    expect(body).not.toMatch(/تسجيل الدخول|Login/);
  });

  test('US-13.3: Logout', async () => {
    const d = db(window);
    const ts = Date.now();
    const username = `E2E-LGOUT-${ts}`;

    await d.run(`DELETE FROM users WHERE username = ?`, [username]);
    await d.run(`INSERT INTO users (username, password, role) VALUES (?,?,?)`,
      [username, 'pass123', 'admin']);

    await loginAs(window, username, 'pass123');

    const logoutBtn = window.locator('button').filter({ hasText: /تسجيل خروج|Logout/ });
    await expect(logoutBtn).toBeVisible({ timeout: 5000 });
    await logoutBtn.click();
    await window.waitForTimeout(500);

    const body = await window.locator('body').textContent();
    expect(body).toMatch(/تسجيل الدخول|Login/);
  });

  test('US-13.4: Admin can access settings', async () => {
    const d = db(window);
    const ts = Date.now();
    const username = `E2E-ADMIN-SET-${ts}`;

    await d.run(`DELETE FROM users WHERE username = ?`, [username]);
    await d.run(`INSERT INTO users (username, password, role) VALUES (?,?,?)`,
      [username, 'admin123', 'admin']);

    await loginAs(window, username, 'admin123');

    const settingsLink = window.locator('text=الإعدادات');
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      await window.waitForTimeout(500);
      const body = await window.locator('body').textContent();
      expect(body).toMatch(/الإعدادات|Settings/);
    } else {
      expect(await settingsLink.isVisible()).toBe(true);
    }
  });

  test('US-13.5: Cashier blocked from settings', async () => {
    const d = db(window);
    const ts = Date.now();
    const username = `E2E-CASH-BLOCK-${ts}`;

    await d.run(`DELETE FROM users WHERE username = ?`, [username]);
    await d.run(`INSERT INTO users (username, password, role) VALUES (?,?,?)`,
      [username, 'cash123', 'cashier']);

    await loginAs(window, username, 'cash123');

    const sidebarLinks = window.locator('.nav-link, .sidebar a, .sidebar button');
    const count = await sidebarLinks.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await sidebarLinks.nth(i).innerText());
    }
    expect(texts).not.toContain('الإعدادات');
  });

  test('US-13.6: Wrong credentials', async () => {
    const d = db(window);
    const ts = Date.now();
    const username = `E2E-WRONG-${ts}`;

    await d.run(`DELETE FROM users WHERE username = ?`, [username]);
    await d.run(`INSERT INTO users (username, password, role) VALUES (?,?,?)`,
      [username, 'correctPass', 'cashier']);

    const loginBtn = window.locator('button').filter({ hasText: 'تسجيل الدخول' });
    if (await loginBtn.isVisible()) {
      await window.locator('input').first().fill(username);
      await window.locator('input[type="password"]').fill('wrongPassword');
      await loginBtn.click();
      await window.waitForTimeout(1000);
      const body = await window.locator('body').textContent();
      expect(body).toMatch(/تسجيل الدخول|Login|خطأ|Error/);
    } else {
      await loginAs(window, username, 'correctPass');
      const logoutBtn = window.locator('button').filter({ hasText: /تسجيل خروج|Logout/ });
      await logoutBtn.click();
      await window.waitForTimeout(500);
      await window.locator('input').first().fill(username);
      await window.locator('input[type="password"]').fill('wrongPassword');
      await window.locator('button').filter({ hasText: 'تسجيل الدخول' }).click();
      await window.waitForTimeout(1000);
      const body = await window.locator('body').textContent();
      expect(body).toMatch(/تسجيل الدخول|Login|خطأ|Error/);
    }
  });

  test('US-13.7: Delete user', async () => {
    const d = db(window);
    const ts = Date.now();
    const username = `E2E-DELUSER-${ts}`;

    await d.run(`DELETE FROM users WHERE username = ?`, [username]);
    await d.run(`INSERT INTO users (username, password, role) VALUES (?,?,?)`,
      [username, 'deleteMe', 'cashier']);

    await d.run(`DELETE FROM users WHERE username = ?`, [username]);

    const user = await d.get(`SELECT id FROM users WHERE username = ?`, [username]);
    expect(user).toBeUndefined();
  });

  test('US-13.8: Session persistence after reload', async () => {
    const d = db(window);
    const ts = Date.now();
    await d.run(`DELETE FROM users WHERE username = ?`, [`sessionuser${ts}`]);
    await d.run(`INSERT INTO users (username, password, role) VALUES (?,?,?)`,
      [`sessionuser${ts}`, 'testpass', 'admin']);
    // Navigate to login
    await window.goto('http://localhost:3000');
    await window.waitForTimeout(1000);
    // Login
    await window.fill('input', `sessionuser${ts}`);
    await window.fill('input[type="password"]', 'testpass');
    await window.click('button:has-text("دخول")');
    await window.waitForTimeout(1000);
    // Reload
    await window.reload();
    await window.waitForTimeout(1000);
    // Verify still logged in (should see sidebar, not login page)
    const body = await window.textContent('body');
    expect(body).not.toContain('تسجيل الدخول');
    await d.run(`DELETE FROM users WHERE username = ?`, [`sessionuser${ts}`]);
  });
});
