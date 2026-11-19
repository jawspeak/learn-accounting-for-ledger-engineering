import { expect, test } from '@playwright/test';
import { addAccountByKeyboard, BOOKING, enterCorrectCashToChecking } from './helpers';

test('progress: tried then solved shows in the nav, the bar and the problem; reset clears it', async ({
  page,
}) => {
  await page.goto(BOOKING);
  await expect(page.getByRole('heading', { name: 'Deposit cash into checking' })).toBeVisible();
  const nav = page.locator('#site-nav');
  const mine = nav.locator('.nav-problems [aria-current="page"]');
  await expect(mine.locator('.nav-status')).toHaveClass(/is-todo/);

  // A wrong check: "tried".
  await addAccountByKeyboard(page, 'Asset', 'Checking Account');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(mine.locator('.nav-status')).toHaveClass(/is-tried/);
  await expect(page.locator('.problem-status')).toContainText('Tried');

  // Start over and solve it: "solved", everywhere, and it survives a reload.
  await page.goto(BOOKING);
  await enterCorrectCashToChecking(page);
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.locator('.fb-headline')).toContainText('Correct!');
  await expect(page.locator('.problem-status')).toContainText('✓ Solved');
  await page.reload();
  await expect(mine.locator('.nav-status')).toHaveClass(/is-solved/);
  await expect(page.locator('.progress-bar .progress-slot.is-solved')).toHaveCount(1);
  await expect(page.locator('.progress-bar')).toHaveAttribute(
    'aria-label',
    /Your progress: 1 of \d+/,
  );

  // Bottom of the nav: summary + a small Reset.
  await expect(page.locator('.progress-summary')).toContainText(/1 of \d+/);
  page.once('dialog', (d) => d.accept());
  await page.locator('.progress-summary').getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('.progress-summary')).toContainText(/0 of \d+/);
  await expect(page.locator('.progress-bar .progress-slot.is-solved')).toHaveCount(0);
});

test('a worked example (no Check button) counts as done when you click Next', async ({ page }) => {
  await page.goto('./#/p/00-tour-savings-to-checking');
  const status = (n: string) =>
    page
      .locator('#site-nav .nav-problems a', { hasText: new RegExp(`^${n} `) })
      .locator('.nav-status');
  await expect(status('0.1')).toHaveClass(/is-todo/);
  await page.locator('nav.pager').getByRole('link', { name: /0\.2/ }).click();
  await expect(page.locator('.breadcrumb')).toContainText('Problem 0.2');
  await expect(status('0.1')).toHaveClass(/is-solved/);
});

test('a worked example counts as done after lingering on its end', async ({ page }) => {
  await page.goto('./#/p/03-atm-withdrawal');
  const mine = page.locator('#site-nav .nav-problems [aria-current="page"] .nav-status');
  await expect(mine).toHaveClass(/is-todo/);
  await page.locator('.worked-read-marker').scrollIntoViewIfNeeded();
  // Not straight away — only after it has stayed in view for a few seconds.
  await page.waitForTimeout(1000);
  await expect(mine).toHaveClass(/is-todo/);
  await expect(mine).toHaveClass(/is-solved/, { timeout: 5000 });
  await expect(page.locator('.problem-status').first()).toContainText('Solved');
});
