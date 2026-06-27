import { test, expect } from '../../tests/fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
    all: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.all(s, p), [sql, params || []]),
  };
}

test.describe('Chart of Accounts', () => {
  let window;

  test.beforeEach(async ({ window: w }) => {
    window = w;
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('جاري التحميل');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);
  });

  test('should display seeded accounts', async () => {
    const d = db(window);

    const accounts = await d.all('SELECT * FROM accounts WHERE is_active = 1 ORDER BY code');
    console.log(`Found ${accounts.length} active accounts`);

    expect(accounts.length).toBeGreaterThanOrEqual(16);
    expect(accounts[0].code).toBe('1110');
    expect(accounts[0].name).toContain('نقدية');
  });

  test('should render account groups on the page', async () => {
    await window.evaluate(() => {
      window.location.hash = '#/accounting/chart-of-accounts';
    });
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('جاري التحميل');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);

    await window.waitForSelector('table', { timeout: 15000 });

    const rows = await window.$$('table tbody tr');
    expect(rows.length).toBeGreaterThanOrEqual(16);
  });

  test('should open add account modal', async () => {
    await window.evaluate(() => {
      window.location.hash = '#/accounting/chart-of-accounts';
    });
    await window.waitForFunction(() => {
      if (!document.body) return false;
      return !document.body.textContent.includes('جاري التحميل');
    }, { timeout: 20000 }).catch(() => {});
    await window.waitForTimeout(500);

    await window.waitForSelector('table', { timeout: 15000 });

    const addBtn = await window.$('button:has-text("إضافة حساب")');
    expect(addBtn).toBeTruthy();
    await addBtn.click();

    await window.waitForSelector('.modal-overlay', { timeout: 5000 });
    const modalTitle = await window.$eval('.modal-title', el => el.textContent);
    expect(modalTitle).toContain('إضافة حساب');
  });

  test('should create and delete an account', async () => {
    const d = db(window);

    const result = await d.run(
      "INSERT INTO accounts (code, name, type, is_active) VALUES (?, ?, ?, ?)",
      ['9999', 'Test Account E2E', 'asset', 1]
    );
    expect(result.lastInsertRowid).toBeGreaterThan(0);

    const account = await d.get("SELECT * FROM accounts WHERE code = '9999'");
    expect(account).toBeTruthy();
    expect(account.name).toBe('Test Account E2E');

    await d.run("DELETE FROM accounts WHERE code = '9999'");
    const gone = await d.get("SELECT * FROM accounts WHERE code = '9999'");
    expect(gone).toBeFalsy();
  });
});
