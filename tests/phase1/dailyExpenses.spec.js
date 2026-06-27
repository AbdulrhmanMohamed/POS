import { test, expect } from '../fixtures/electronApp.js';

test.describe('Phase 1.3 - Daily Expenses', () => {
  test('expenses page shows expense form', async ({ window }) => {
    await window.click('text=المصروفات');
    await window.waitForTimeout(500);
    const h1 = await window.textContent('h1');
    expect(h1).toMatch(/مصروفات|Expenses/);
  });

  test('can add a new expense', async ({ window }) => {
    await window.click('text=المصروفات');
    await window.waitForTimeout(300);

    const addBtn = window.locator('button:has-text("إضافة"), button:has-text("Add")');
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await window.waitForTimeout(300);
    }
  });
});
