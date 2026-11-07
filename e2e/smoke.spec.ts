import { expect, test } from '@playwright/test';

test('home lists sections and sample problem can be solved', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'Learn Accounting for Ledger Engineering' })).toBeVisible();
  await page.goto('/#/p/03-cash-to-checking');
  await expect(page.getByRole('heading', { name: 'Deposit cash into checking' })).toBeVisible();
});
