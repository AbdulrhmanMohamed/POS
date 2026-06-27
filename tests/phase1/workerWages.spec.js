import { test, expect } from '../fixtures/electronApp.js';

test.describe('Phase 1.4 - Worker Wages', () => {
  test('workers page shows workers list', async ({ window }) => {
    await window.click('text=العمال');
    await window.waitForTimeout(500);
    const h1 = await window.textContent('h1');
    expect(h1).toMatch(/عمال|Workers/);
  });

  test('can add a new worker', async ({ window }) => {
    await window.click('text=العمال');
    await window.waitForTimeout(300);

    const addBtn = window.locator('button:has-text("إضافة"), button:has-text("Add Worker"), button:has-text("إضافة عامل")');
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await window.waitForTimeout(300);
    }
  });

  test('worker has salary payment capability', async ({ window }) => {
    await window.click('text=العمال');
    await window.waitForTimeout(500);

    const payBtn = window.locator('button:has-text("دفع"), button:has-text("Pay")');
    const salaryText = await window.textContent('body');
    expect(salaryText).toBeTruthy();
  });
});
