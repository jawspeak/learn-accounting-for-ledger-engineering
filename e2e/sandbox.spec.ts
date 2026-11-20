import { expect, test } from '@playwright/test';
import { watchErrors } from './helpers';

test('example scenario loads, edit updates ?d=, reload restores', async ({ page }) => {
  const w = watchErrors(page);
  await page.goto('/#/sandbox');
  await page.getByRole('button', { name: 'Sandbox menu' }).click();
  await page.getByLabel('Example scenarios:').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Yes, replace' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Loaded example' })).toBeVisible();
  await expect.poll(() => page.url()).toContain('?d=');
  const before = page.url();
  await page.getByRole('textbox', { name: 'Sandbox title' }).fill('My edited board');
  await expect.poll(() => page.url()).not.toBe(before);
  expect(page.url()).toContain('?d=');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Sandbox title' })).toHaveValue('My edited board');
  w.assertClean();
});

test('Export a .json file, then Import it into an empty Sandbox', async ({ page }, info) => {
  const w = watchErrors(page);
  await page.goto('/#/sandbox');
  await page.getByRole('button', { name: 'Sandbox menu' }).click();
  await page.getByLabel('Example scenarios:').selectOption('fbo');
  await page.getByRole('button', { name: 'Yes, replace' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Sandbox menu' }).click();
  await page.getByRole('button', { name: 'Export' }).click();
  // The title, then the UTC time it was saved.
  expect((await download).suggestedFilename()).toMatch(
    /^zap-a-wallet-on-an-fbo-account-\d{8}-\d{6}Z\.json$/,
  );
  const file = info.outputPath('zap.json');
  await (await download).saveAs(file);

  await page.getByRole('button', { name: 'Sandbox menu' }).click();
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('button', { name: 'Yes, replace' }).click();
  await expect(page.getByRole('tablist', { name: 'Scenarios' }).getByRole('tab')).toHaveCount(1);

  await page.getByLabel('Import a Sandbox file').setInputFiles(file);
  await expect(page.getByRole('group', { name: 'Confirm replace' })).toContainText('3 scenarios');
  await page.getByRole('button', { name: 'Yes, replace' }).click();
  const tabs = page.getByRole('tablist', { name: 'Scenarios' }).getByRole('tab');
  // "S1 ✓ Alice tops up $50 (balances)"…: the title is in each tab.
  await expect(tabs).toContainText([
    'Alice tops up $50',
    'Alice pays Bob $20 in Zap',
    'Bob cashes out, less a $1 fee',
  ]);
  await expect(page.getByRole('textbox', { name: 'Sandbox title' })).toHaveValue(
    'Zap — a wallet on an FBO account',
  );
  w.assertClean();
});

test('malicious scenario is inert', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', async (d) => {
    dialogs.push(d.message());
    await d.dismiss();
  });
  await page.goto('/#/sandbox');
  await page.getByRole('button', { name: /Describe what happens/ }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const payload = '<img src=x onerror=alert(1)> <script>alert(2)</script> [x](javascript:alert(3))';
  await page.getByRole('textbox', { name: 'Scenario text (markdown)' }).fill(payload);
  await page.getByRole('button', { name: 'Preview' }).click();
  const preview = page.locator('.sbx-scenario-preview');
  await expect(preview).toContainText('onerror=alert(1)');
  await expect(page.locator('img[onerror]')).toHaveCount(0);
  await expect(preview.locator('img, script')).toHaveCount(0);
  await expect(preview.locator('a[href^="javascript"]')).toHaveCount(0);
  await expect.poll(() => page.url()).toContain('?d=');
  await page.reload();
  await expect(page.locator('img[onerror]')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Sandbox title' })).toBeVisible();
  expect(dialogs).toEqual([]);
});

test('a file that isn’t valid says where; the format docs are published for agents', async ({
  page,
}, info) => {
  const w = watchErrors(page);
  await page.goto('/#/sandbox');
  const bad = info.outputPath('bad.json');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(bad, JSON.stringify({ v: 3, entities: [], scenarios: [] }));
  await page.getByLabel('Import a Sandbox file').setInputFiles(bad);
  const alert = page.getByRole('alert').filter({ hasText: 'isn’t a valid Sandbox file' });
  await expect(alert).toContainText('scenarios: Too small');
  await expect(alert.getByRole('link', { name: 'sandbox-format.md' })).toBeVisible();
  for (const f of [
    'llms.txt',
    'sandbox-format.md',
    'sandbox.schema.json',
    'sandbox-example.json',
  ]) {
    const res = await page.request.get(`/${f}`);
    expect(res.ok(), f).toBe(true);
  }
  w.assertClean();
});
