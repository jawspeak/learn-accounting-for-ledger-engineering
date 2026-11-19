import { expect, test } from '@playwright/test';
import { watchErrors } from './helpers';

test('⌘K search: type, choose with the keyboard, land on the block', async ({ page }) => {
  const w = watchErrors(page);
  await page.goto('/#/');
  await expect(page.getByRole('button', { name: /^Search/ })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  const box = page.getByRole('combobox', { name: /Search/ });
  await expect(box).toBeFocused();

  // Titles only: a common word finds a short list, its definition first.
  await box.fill('debit');
  const opts = page.getByRole('option');
  await expect(opts.first()).toContainText('Debit');
  expect(await opts.count()).toBeLessThan(20);

  // A callout deep link scrolls to and highlights the callout.
  await box.fill('loan created');
  await expect(opts.first()).toContainText('The loan created a deposit');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/s\/06-loans\?at=callout-1/);
  await expect(page.getByRole('dialog', { name: 'Search' })).toHaveCount(0);
  await expect(page.locator('#callout-1')).toBeInViewport();

  // The header button opens it too; "6.3" jumps to that problem.
  await page.getByRole('button', { name: /^Search/ }).click();
  await page.getByRole('combobox', { name: /Search/ }).fill('6.3');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/p\/06-/);
  await expect(page.locator('main h1')).toBeVisible();
  w.assertClean();
});

test('search fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto('/#/');
  await page.getByRole('button', { name: /^Search/ }).click();
  await page.getByRole('combobox', { name: /Search/ }).fill('fbo');
  const dlg = page.getByRole('dialog', { name: 'Search' });
  const box = await dlg.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  await page.getByRole('button', { name: /Close search/ }).click();
  await expect(dlg).toHaveCount(0);
});
