import { expect, test } from '@playwright/test';
import { addAccountByKeyboard, BOOKING, enterCorrectCashToChecking, watchErrors } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto(BOOKING);
  await expect(page.getByRole('heading', { name: 'Deposit cash into checking' })).toBeVisible();
});

test('keyboard-only booking: row balances, Check says correct', async ({ page }) => {
  const w = watchErrors(page);
  await enterCorrectCashToChecking(page);
  await expect(page.locator('tr[data-row] .tab-rowcheck.is-ok')).toContainText('Balanced');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.locator('.fb-headline')).toContainText('Correct!');
  await page.getByRole('button', { name: 'Why does this work?' }).click();
  await expect(page.getByRole('heading', { name: 'Why this works' })).toBeVisible();
  w.assertClean();
});

test('wrong answer: issue count, then Tell me more through levels 2-5', async ({ page }) => {
  await addAccountByKeyboard(page, 'Asset', 'Checking Account');
  await addAccountByKeyboard(page, 'Asset', 'Cash');
  // Wrong sides: Dr Cash, Cr Checking.
  await page.getByRole('textbox', { name: 'Row 1 Cash Dr' }).fill('100');
  await page.getByRole('textbox', { name: 'Row 1 Checking Account Cr' }).fill('100');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.locator('.fb-headline')).toContainText(/\d+ issues? found/);
  await expect(page.getByText('Feedback step 1 of 5')).toBeVisible();
  for (let level = 2; level <= 4; level++) {
    await page.getByRole('button', { name: 'Tell me more' }).click();
    await expect(page.getByText(`Feedback step ${level} of 5`)).toBeVisible();
  }
  await expect(page.locator('.fb-msg').first()).toBeVisible();
  await expect(page.locator('.fb-expl').first()).toBeVisible();
  await page.getByRole('button', { name: 'Show the full solution' }).click();
  await expect(page.getByRole('heading', { name: 'Solution' })).toBeVisible();
});

test('hints reveal one at a time', async ({ page }) => {
  const list = page.locator('.fb-hint-list li');
  await expect(list).toHaveCount(0);
  await page.getByRole('button', { name: /Show a hint \(1 of 3\)/ }).click();
  await expect(list).toHaveCount(1);
  await page.getByRole('button', { name: /Show next hint \(2 of 3\)/ }).click();
  await expect(list).toHaveCount(2);
  await page.getByRole('button', { name: /Show next hint \(3 of 3\)/ }).click();
  await expect(list).toHaveCount(3);
  await expect(page.getByText('That’s all the hints.')).toBeVisible();
});

test('trap account (Customer Deposits) shows counterparty explanation at level 4', async ({ page }) => {
  await addAccountByKeyboard(page, 'Asset', 'Customer Deposits');
  await addAccountByKeyboard(page, 'Asset', 'Cash');
  await page.getByRole('textbox', { name: 'Row 1 Customer Deposits Dr' }).fill('100');
  await page.getByRole('textbox', { name: 'Row 1 Cash Cr' }).fill('100');
  await page.getByRole('button', { name: 'Check answer' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Tell me more' }).click();
  await expect(page.getByText('Feedback step 4 of 5')).toBeVisible();
  await expect(page.locator('.fb-expl').filter({ hasText: "bank's" })).toBeVisible();
});

test('attempt sharing: URL has ?a=, reload restores, Copy link shows status', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await enterCorrectCashToChecking(page);
  await expect.poll(() => page.url()).toContain('?a=');
  const url = page.url();
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Link copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Row 1 Checking Account Dr' })).toHaveValue('100');
  await expect(page.getByRole('textbox', { name: 'Row 1 Cash Cr' })).toHaveValue('100');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.locator('.fb-headline')).toContainText('Correct!');
});

test('Open in Sandbox carries the problem accounts', async ({ page }) => {
  await enterCorrectCashToChecking(page);
  await page.getByRole('link', { name: 'Open in Sandbox' }).click();
  await expect(page).toHaveURL(/#\/sandbox\?d=/);
  await expect(page.locator('[data-col-head]').filter({ hasText: 'Checking Account' })).toBeVisible();
  await expect(page.locator('[data-col-head]').filter({ hasText: 'Cash' })).toBeVisible();
});

test('prev/next navigation resets the answer', async ({ page }) => {
  await enterCorrectCashToChecking(page);
  await page.getByRole('link', { name: /Transfer checking → savings/ }).click();
  await expect(page.getByRole('heading', { name: 'Transfer checking → savings' })).toBeVisible();
  expect(page.url()).not.toContain('?a=');
  await expect(page.locator('.tab-amount')).toHaveCount(0);
  await page.getByRole('link', { name: /Deposit cash into checking/ }).click();
  await expect(page.getByRole('heading', { name: 'Deposit cash into checking' })).toBeVisible();
  await expect(page.locator('.tab-amount')).toHaveCount(0);
  await expect(page.locator('.fb-headline')).toHaveCount(0);
});
