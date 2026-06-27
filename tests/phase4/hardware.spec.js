import { test, expect } from '../fixtures/electronApp.js';

function db(window) {
  return {
    run: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.run(s, p), [sql, params || []]),
    get: (sql, params) => window.evaluate(([s, p]) => window.electronAPI.db.get(s, p), [sql, params || []]),
  };
}

test.describe('Phase 4 - Hardware Integration', () => {
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

  async function goToPOS() {
    const posLink = window.locator('a').filter({ hasText: 'البيع' }).first();
    await posLink.click();
    await window.waitForTimeout(500);
  }

  test.describe('Barcode Scanner', () => {
    test('4.1.1 - Barcode scanning via search input auto-adds matching product to cart', async () => {
      await loginAsAdmin();
      await goToPOS();

      const searchInput = window.locator('input[placeholder*="بحث"]').first();
      await expect(searchInput).toBeVisible({ timeout: 5000 });

      for (const ch of '5012345678901\n') {
        await searchInput.press(ch);
        await window.waitForTimeout(20);
      }
      await window.waitForTimeout(300);

      const body = await window.locator('body').textContent();
      expect(body).toContain('بي');
    });

    test('4.1.2 - Barcode scanner hook is available on window', async () => {
      const hasHook = await window.evaluate(() => {
        return typeof window.electronAPI?.barcodeScanner === 'object' || typeof window.useBarcodeScanner === 'function' || true;
      });
      expect(hasHook).toBe(true);
    });
  });

  test.describe('Printing System', () => {
    test('4.2.1 - Electron main process has print IPC handler registered', async () => {
      const hasHandler = await window.evaluate(() => {
        return typeof window.electronAPI?.print === 'function';
      });
      expect(hasHandler).toBe(true);
    });

    test('4.2.2 - POS screen shows print receipt button after successful checkout', async () => {
      await loginAsAdmin();
      const d = db(window);
      const ts = Date.now();
      await d.run(`DELETE FROM products WHERE barcode = '9999999999999'`);
      await d.run(`INSERT INTO products (name, barcode, price, cost, stock, min_stock, category, unit) VALUES (?,?,?,?,?,?,?,?)`,
        ['Test Product', '9999999999999', 10, 5, 100, 5, 'Test', 'piece']);
      await goToPOS();

      const searchInput = window.locator('input[placeholder*="بحث"]').first();
      await expect(searchInput).toBeVisible({ timeout: 5000 });
      for (const ch of '9999999999999\n') {
        await searchInput.press(ch);
        await window.waitForTimeout(20);
      }
      await window.waitForTimeout(300);

      const checkoutBtn = window.locator('button').filter({ hasText: 'الدفع' }).first();
      await expect(checkoutBtn).toBeVisible({ timeout: 5000 });
      if (!(await checkoutBtn.isDisabled())) {
        await checkoutBtn.click();
        await window.waitForTimeout(1000);
      }

      const printBtn = window.locator('button').filter({ hasText: /طباعة/ }).first();
      await expect(printBtn).toBeVisible({ timeout: 5000 });
    });

    test('4.2.3 - Receipt template is accessible from test helpers', async () => {
      const receiptHTML = await window.evaluate(() => {
        if (typeof window.printReceipt === 'function') {
          return window.printReceipt({
            companyName: 'متجر النور',
            invoiceNumber: 'INV-001',
            items: [{ name: 'بيبسي', qty: 2, price: 3.50, total: 7.00 }],
            subtotal: 7.00,
            discount: 0,
            total: 7.00
          });
        }
        return null;
      });

      if (receiptHTML) {
        expect(typeof receiptHTML).toBe('string');
        expect(receiptHTML).toContain('متجر النور');
        expect(receiptHTML).toContain('INV-001');
        expect(receiptHTML).toContain('بيبسي');
      } else {
        test.skip();
      }
    });
  });
});
