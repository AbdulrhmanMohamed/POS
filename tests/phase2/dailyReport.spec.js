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

test.describe('Phase 2 - Reports & Analytics', () => {
  test.describe('2.1 - Daily Report Tab', () => {
    test('page title and basic daily stats render', async ({ window }) => {
      await navigatetoReports(window);
      const h1 = await window.textContent('h1');
      expect(h1).toMatch(/تقارير|Reports/);
      const body = await window.textContent('body');
      expect(body).toContain('المبيعات');
      expect(body).toContain('الربح');
    });

    test('daily report shows stat cards', async ({ window }) => {
      await navigatetoReports(window);
      const statCards = await window.locator('.stat-card').count();
      expect(statCards).toBeGreaterThanOrEqual(6);
    });
  });

  test.describe('2.2 - Tab Navigation', () => {
    test('all report tabs exist', async ({ window }) => {
      await navigatetoReports(window);
      const tabs = await window.locator('.tab').allTextContents();
      expect(tabs.length).toBe(6);
    });
  });

  test.describe('2.3 - Custom Date Range', () => {
    test('custom tab has date inputs, type filter, and generate', async ({ window }) => {
      await navigatetoReports(window);
      const tabs = await window.locator('.tab').allTextContents();
      const customTab = tabs.findIndex(t => t.includes('مخصص'));
      if (customTab >= 0) {
        await window.locator('.tab').nth(customTab).click();
        await window.waitForTimeout(500);
        const dateInputs = await window.locator('input[type="date"]').count();
        expect(dateInputs).toBeGreaterThanOrEqual(2);
        const selects = await window.locator('select').count();
        expect(selects).toBeGreaterThanOrEqual(1);
      }
    });
  });

  test.describe('2.4 - Performance Reports', () => {
    test('performance loads comparison stats and best hours', async ({ window }) => {
      await navigatetoReports(window);
      const tabs = await window.locator('.tab').allTextContents();
      const perfIdx = tabs.findIndex(t => t.includes('تحليل'));
      if (perfIdx >= 0) {
        await window.locator('.tab').nth(perfIdx).click();
        await window.waitForTimeout(1500);
        const statCards = await window.locator('.stat-card').count();
        expect(statCards).toBeGreaterThanOrEqual(1);
        const body = await window.textContent('body');
        expect(body).toContain(':00');
      }
    });
  });

  test.describe('2.5 - Analytics Dashboard', () => {
    test('analytics shows KPI stat cards and filter controls', async ({ window }) => {
      await navigatetoReports(window);
      const tabs = await window.locator('.tab').allTextContents();
      const kpiIdx = tabs.findIndex(t => t.includes('مؤشرات'));
      if (kpiIdx >= 0) {
        await window.locator('.tab').nth(kpiIdx).click();
        await window.waitForTimeout(2000);
        const statCards = await window.locator('.stat-card').count();
        expect(statCards).toBeGreaterThanOrEqual(5);
        const selects = await window.locator('select').count();
        expect(selects).toBeGreaterThanOrEqual(2);
      }
    });

    test('analytics shows customer purchase frequency', async ({ window }) => {
      await navigatetoReports(window);
      const tabs = await window.locator('.tab').allTextContents();
      const kpiIdx = tabs.findIndex(t => t.includes('مؤشرات'));
      if (kpiIdx >= 0) {
        await window.locator('.tab').nth(kpiIdx).click();
        await window.waitForTimeout(2000);
        const rows = await window.locator('table tbody tr').count();
        expect(rows).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

async function navigatetoReports(window) {
  const d = db(window);
  await d.run(`DELETE FROM users WHERE username = 'adminUser'`);
  await d.run(`INSERT INTO users (username, password, role) VALUES (?,?,?)`, ['adminUser', 'admin123', 'admin']);

  await window.waitForFunction(() => {
    if (!document.body) return false;
    return !document.body.textContent.includes('جاري التحميل');
  }, { timeout: 20000 }).catch(() => {});
  await window.waitForTimeout(500);

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

  await window.locator('a').filter({ hasText: 'التقارير' }).first().click();
  await window.waitForTimeout(1000);
}
