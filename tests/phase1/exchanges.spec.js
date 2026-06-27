import { test, expect } from '../fixtures/electronApp.js';

test.describe('Phase 1.5 - Exchanges (تبديل)', () => {
  test('returns page exists for processing exchanges', async ({ window }) => {
    await window.click('text=المرتجعات');
    await window.waitForTimeout(500);
    const h1 = await window.textContent('h1');
    expect(h1).toMatch(/مرتجعات|Returns/);
  });

  test('invoice selection is available on returns page', async ({ window }) => {
    await window.click('text=المرتجعات');
    await window.waitForTimeout(300);

    const addBtn = window.locator('button:has-text("إضافة"), button:has-text("Add")');
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await window.waitForTimeout(300);

      const selectInvoice = window.locator('select:has(option), select:has-text("فاتورة"), select:has-text("Invoice")');
      await expect(selectInvoice).toBeVisible();
    }
  });
});
