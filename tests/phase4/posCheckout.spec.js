import { test, expect } from '../fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
  };
}

test.describe('Phase 4 - POS Checkout', () => {
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

  test('4.3.1 - POS checkout creates invoice with valid numeric amounts (no NaN)', async () => {
    const d = db(window);

    // Seed a product BEFORE login so POS loads it fresh
    await d.run(`DELETE FROM products WHERE barcode = '9990009990001'`);
    await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
      ['AAA Checkout Test', '9990009990001', 15.50, 8, 100, 5, 'Test', 'piece']);

    await loginAsAdmin();

    // Navigate to Products page then back to POS to force fresh product load
    const productsLink = window.locator('a').filter({ hasText: 'المنتجات' }).first();
    await productsLink.click();
    await window.waitForTimeout(400);
    const posLink = window.locator('a').filter({ hasText: 'البيع' }).first();
    await posLink.click();
    await window.waitForTimeout(800);

    // Click the product card in the grid to add to cart
    const productCard = window.locator('.card').filter({ hasText: 'AAA Checkout Test' }).first();
    await expect(productCard).toBeVisible({ timeout: 5000 });
    await productCard.click();
    await window.waitForTimeout(300);

    // Verify cart shows the product
    const bodyText = await window.locator('body').textContent();
    expect(bodyText).toContain('AAA Checkout Test');

    // Press "إفراغ السلة" first to clear any leftover items from other tests
    const clearBtn = window.locator('button').filter({ hasText: 'إفراغ السلة' }).first();
    if (await clearBtn.isEnabled()) {
      await clearBtn.click();
      await window.waitForTimeout(200);
    }

    // Add the product to cart again (after clearing cart)
    await productCard.click();
    await window.waitForTimeout(300);

    // Click checkout
    const checkoutBtn = window.locator('button').filter({ hasText: 'الدفع' }).first();
    await expect(checkoutBtn).toBeVisible({ timeout: 5000 });
    expect(await checkoutBtn.isDisabled()).toBe(false);
    await checkoutBtn.click();
    await window.waitForTimeout(2000);

    // Verify no NaN error
    const bodyAfter = await window.locator('body').textContent();
    expect(bodyAfter).not.toContain('NaN');

    // Verify invoice was created in DB with valid total
    const invoice = await d.get(`SELECT * FROM invoices ORDER BY id DESC LIMIT 1`);
    expect(invoice).not.toBeNull();
    const total = parseFloat(invoice.total);
    expect(isNaN(total)).toBe(false);
    expect(total).toBeGreaterThan(0);

    // Verify invoice items have numeric prices
    const itemsResult = await window.evaluate(() =>
      window.electronAPI.db.all('SELECT * FROM invoice_items ORDER BY id DESC LIMIT 1')
    );
    expect(itemsResult.length).toBeGreaterThan(0);
    const unitPrice = parseFloat(itemsResult[0].unit_price);
    const totalPrice = parseFloat(itemsResult[0].total_price);
    expect(isNaN(unitPrice)).toBe(false);
    expect(isNaN(totalPrice)).toBe(false);

    // Cleanup
    const invId = invoice.id;
    await d.run(`DELETE FROM invoice_items WHERE invoice_id = ?`, [invId]);
    await d.run(`DELETE FROM inventory WHERE notes LIKE ?`, [`%${invoice.invoice_number}%`]);
    await d.run(`DELETE FROM invoices WHERE id = ?`, [invId]);
    await d.run(`DELETE FROM products WHERE barcode = '9990009990001'`);
  });
});
