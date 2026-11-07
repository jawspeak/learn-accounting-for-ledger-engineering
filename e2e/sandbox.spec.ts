import { expect, test } from '@playwright/test';
import { watchErrors } from './helpers';

test('example scenario loads, edit updates ?d=, reload restores', async ({ page }) => {
  const w = watchErrors(page);
  await page.goto('/#/sandbox');
  await page.getByLabel('Example scenarios:').selectOption({ index: 1 });
  await expect(page.getByRole('status').filter({ hasText: 'Loaded example' })).toBeVisible();
  await expect.poll(() => page.url()).toContain('?d=');
  const before = page.url();
  await page.getByRole('textbox', { name: 'Board title' }).fill('My edited board');
  await expect.poll(() => page.url()).not.toBe(before);
  expect(page.url()).toContain('?d=');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Board title' })).toHaveValue('My edited board');
  w.assertClean();
});

test('malicious scenario is inert', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', async (d) => {
    dialogs.push(d.message());
    await d.dismiss();
  });
  await page.goto('/#/sandbox');
  await page.getByRole('button', { name: 'Edit' }).click();
  const payload = '<img src=x onerror=alert(1)> <script>alert(2)</script> [x](javascript:alert(3))';
  await page.getByRole('textbox', { name: 'Scenario (markdown)' }).fill(payload);
  await page.getByRole('button', { name: 'Preview' }).click();
  const preview = page.locator('.sbx-scenario-preview');
  await expect(preview).toContainText('onerror=alert(1)');
  await expect(page.locator('img[onerror]')).toHaveCount(0);
  await expect(preview.locator('img, script')).toHaveCount(0);
  await expect(preview.locator('a[href^="javascript"]')).toHaveCount(0);
  await expect.poll(() => page.url()).toContain('?d=');
  await page.reload();
  await expect(page.locator('img[onerror]')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Board title' })).toBeVisible();
  expect(dialogs).toEqual([]);
});
