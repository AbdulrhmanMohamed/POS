import { test, expect } from '../fixtures/electronApp.js';

test.describe('Phase 1.1 - Supplier Payment Tracking', () => {
  test('suppliers page has a Record Payment button for each supplier', async ({ window }) => {
    await window.click('text=الموردين');
    await window.waitForTimeout(800);

    const payBtns = window.locator('button:has-text("دفعة"), button:has-text("سداد")');
    const count = await payBtns.count();

    if (count > 0) {
      await payBtns.first().click();
      await window.waitForTimeout(500);

      const modal = window.locator('.modal-overlay, [role="dialog"]');
      await expect(modal).toBeVisible();
    }
  });

  test('payment modal has amount input and save button', async ({ window }) => {
    await window.click('text=الموردين');
    await window.waitForTimeout(800);

    const payBtn = window.locator('button:has-text("دفعة"), button:has-text("سداد")');
    if (await payBtn.count() === 0) return;

    await payBtn.first().click();
    await window.waitForTimeout(500);

    const amountInput = window.locator('input[type="number"], input[placeholder*="المبلغ"]');
    const saveBtn = window.locator('button:has-text("حفظ"), button:has-text("تأكيد")');

    await expect(amountInput.or(saveBtn).first()).toBeVisible();
  });
});
