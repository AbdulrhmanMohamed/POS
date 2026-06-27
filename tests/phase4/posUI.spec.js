import { test, expect } from '../fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
  };
}

test.describe('Phase 4 - POS UI Improvements', () => {
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
    const logoutBtn = window.locator('button').filter({ hasText: /تسجيل خروج|Logout/ });
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await window.waitForTimeout(300);
    }
    await window.locator('input').first().fill('adminUser');
    await window.locator('input[type="password"]').fill('admin123');
    await window.locator('button').filter({ hasText: 'تسجيل الدخول' }).click();
    await window.waitForTimeout(1500);
  }

  test('4.5.1 - POS shows unified search input and category filter dropdown', async () => {
    const d = db(window);
    await d.run(`DELETE FROM products WHERE barcode LIKE 'UI-TEST-%'`);
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['UI Cat A', 'UI-TEST-CAT-A', 10, 5, 50, 5, 'CategoryA', 'piece']);
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['UI Cat B', 'UI-TEST-CAT-B', 20, 10, 30, 5, 'CategoryB', 'piece']);

    await loginAsAdmin();

    await window.waitForTimeout(1000);

    const searchInput = window.locator('input[placeholder*="Search product" i], input[placeholder*="بحث عن منتج" i]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    const categorySelect = window.locator('select').first();
    await expect(categorySelect).toBeVisible();
    const catOptions = await categorySelect.locator('option').allTextContents();
    expect(catOptions.some(o => o.includes('CategoryA'))).toBe(true);
    expect(catOptions.some(o => o.includes('CategoryB'))).toBe(true);
  });

  test('4.5.2 - Category filter narrows product grid', async () => {
    const d = db(window);
    await d.run(`DELETE FROM products WHERE barcode LIKE 'UI-TEST-%'`);
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['UI Filter A', 'UI-TEST-FILTER-A', 10, 5, 50, 5, 'FilterX', 'piece']);
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['UI Filter B', 'UI-TEST-FILTER-B', 20, 10, 30, 5, 'FilterY', 'piece']);

    await loginAsAdmin();
    await window.waitForTimeout(1000);

    const categorySelect = window.locator('select').first();
    await categorySelect.selectOption('FilterX');
    await window.waitForTimeout(300);

    const body = await window.locator('body').textContent();
    expect(body).toContain('UI Filter A');
    expect(body).not.toContain('UI Filter B');
  });

  test('4.5.3 - Unified search filters products by name', async () => {
    const d = db(window);
    await d.run(`DELETE FROM products WHERE barcode LIKE 'UI-TEST-%'`);
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Samsung Phone', 'UI-TEST-PHONE', 500, 300, 10, 2, 'Electronics', 'piece']);
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Apple Charger', 'UI-TEST-CHARGER', 50, 25, 20, 5, 'Electronics', 'piece']);

    await loginAsAdmin();
    await window.waitForTimeout(1000);

    const searchInput = window.locator('input[placeholder*="Search product" i], input[placeholder*="بحث عن منتج" i]');
    await searchInput.fill('Samsung');
    await window.waitForTimeout(300);

    const body = await window.locator('body').textContent();
    expect(body).toContain('Samsung Phone');
    expect(body).not.toContain('Apple Charger');
  });

  test('4.5.4 - Unified search with exact barcode auto-adds product on Enter', async () => {
    const d = db(window);
    await d.run(`DELETE FROM products WHERE barcode LIKE 'UI-TEST-%'`);
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['Scan To Cart', 'UI-TEST-SCAN', 75, 40, 15, 3, 'Test', 'piece']);

    await loginAsAdmin();
    await window.waitForTimeout(1000);

    const searchInput = window.locator('input[placeholder*="Search product" i], input[placeholder*="بحث عن منتج" i]');
    await searchInput.fill('UI-TEST-SCAN');
    await searchInput.press('Enter');
    await window.waitForTimeout(300);

    const body = await window.locator('body').textContent();
    expect(body).toContain('Scan To Cart');
    expect(body).toContain('75');
  });

  test('4.5.5 - Pagination controls visible when many products exist', async () => {
    const d = db(window);
    await d.run(`DELETE FROM products WHERE barcode LIKE 'UI-TEST-%'`);
    for (let i = 0; i < 25; i++) {
      await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
        [`Paginated ${i}`, `UI-TEST-PAGE-${i}`, 10, 5, 50, 5, 'PaginateTest', 'piece']);
    }

    await loginAsAdmin();
    await window.waitForTimeout(1000);

    const pageBtns = window.locator('button').filter({ hasText: /2|3|التالي|Previous|Next|السابق/ });
    expect(await pageBtns.count()).toBeGreaterThan(0);

    const prevBtn = window.locator('button').filter({ hasText: /Previous|السابق/ });
    await expect(prevBtn).toBeVisible({ timeout: 3000 });
  });

  test('4.5.6 - Pagination navigates to next page with category filter', async () => {
    const d = db(window);
    await d.run(`DELETE FROM products WHERE barcode LIKE 'UI-TEST-%'`);
    for (let i = 0; i < 25; i++) {
      const num = String(i).padStart(3, '0');
      await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
        [`Pagin ${num}`, `UI-TEST-PAGE2-${i}`, 10, 5, 50, 5, 'PaginationTest', 'piece']);
    }

    await loginAsAdmin();
    await window.waitForTimeout(1000);

    // Select the PaginationTest category to isolate these 25 products
    const categorySelect = window.locator('select').first();
    await categorySelect.selectOption('PaginationTest');
    await window.waitForTimeout(300);

    const body1 = await window.locator('body').textContent();
    expect(body1).toContain('Pagin 000');

    const page2Btn = window.locator('button').filter({ hasText: '2' });
    await expect(page2Btn).toBeVisible({ timeout: 3000 });
    await page2Btn.click();
    await window.waitForTimeout(300);

    const body2 = await window.locator('body').textContent();
    expect(body2).not.toContain('Pagin 000');
    expect(body2).toContain('Pagin 020');
  });
});
