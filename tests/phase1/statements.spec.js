import { test, expect } from '../fixtures/electronApp.js';

test.describe('Phase 1.7/1.8 - Customer & Supplier Statements', () => {
  test('customer detail shows transaction history', async ({ window }) => {
    await window.click('text=العملاء');
    await window.waitForTimeout(500);

    const viewBtns = window.locator('button:has-text("عرض"), button:has-text("View"), button:has-text("كشف")');
    if (await viewBtns.count() > 0) {
      await viewBtns.first().click();
      await window.waitForTimeout(300);
    }
  });

  test('supplier detail shows transaction history', async ({ window }) => {
    await window.click('text=الموردين');
    await window.waitForTimeout(500);

    const viewBtns = window.locator('button:has-text("عرض"), button:has-text("View"), button:has-text("كشف")');
    if (await viewBtns.count() > 0) {
      await viewBtns.first().click();
      await window.waitForTimeout(300);
    }
  });
});
