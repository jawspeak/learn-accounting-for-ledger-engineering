import { expect, test } from '@playwright/test';
import { watchErrors } from './helpers';

const headline = (page: import('@playwright/test').Page) => page.locator('.fb-headline');
const check = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Check answer' });

test('worked example: locked solution plus walkthrough', async ({ page }) => {
  await page.goto('/#/p/03-atm-withdrawal');
  await expect(page.getByRole('heading', { name: 'Walkthrough' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Why does this work?' })).toBeVisible();
  await expect(page.locator('tr[data-row].is-locked')).toHaveCount(1);
  await expect(page.locator('.tab-lock-badge')).toHaveText('Example');
  await expect(page.locator('input.tab-amount')).toHaveCount(0);
  await expect(check(page)).toHaveCount(0);
});

test('faded example: the given half is locked; the missing side goes in the same row and checks correct', async ({ page }) => {
  const w = watchErrors(page);
  await page.goto('/#/p/00-tour-cash-to-savings');
  const locked = page.locator('tr[data-row].is-locked');
  await expect(locked).toHaveCount(1);
  await expect(locked.locator('td.is-locked-cell')).toContainText('20');
  // Add Cash; "Enter amounts" lands in Cash's cell in the example row (which is still editable there).
  await page.getByRole('button', { name: /Add account/ }).first().click();
  const picker = page.getByRole('group', { name: 'Add a T-account' });
  await picker.getByRole('radio', { name: 'Asset', exact: true }).check();
  await picker.getByRole('option', { name: 'Cash', exact: true }).click();
  await expect(picker.getByRole('status')).toContainText('Added Cash as an Asset');
  await picker.getByRole('button', { name: 'Enter amounts' }).click();
  await expect(page.getByRole('textbox', { name: 'Row 1 Cash Dr' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Row 1 Cash Cr' }).fill('20');
  await expect(page.locator('.tab-balance-bar.is-ok')).toContainText('Debits = credits in every row');
  await check(page).click();
  await expect(headline(page)).toContainText('Correct!');
  w.assertClean();
});

test('multiple choice: graded on each pick, explains why, key concept when right (no Check button)', async ({ page }) => {
  const w = watchErrors(page);
  await page.goto('/#/p/00-dealer');
  await expect(check(page)).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Liabilities' }).check();
  await expect(page.locator('.q-verdict.is-bad')).toContainText('Not this one.');
  await page.getByRole('checkbox', { name: 'Liabilities' }).uncheck();
  await expect(page.locator('.q-verdict')).toHaveCount(0);
  for (const n of ['Assets', 'Expenses', 'Dividends / owner draws']) await page.getByRole('checkbox', { name: n }).check();
  await expect(page.locator('.q-verdict.is-ok')).toHaveCount(3);
  await expect(page.getByRole('complementary', { name: 'Key concept' })).toBeVisible();
  w.assertClean();
});

test('dr-cr-predict: each row graded as picked; key concept once all are right', async ({ page }) => {
  await page.goto('/#/p/03-review-predict');
  await expect(check(page)).toHaveCount(0);
  await page.getByRole('group', { name: 'increase Loan to a Friend' }).getByRole('radio', { name: 'Credit' }).check();
  await expect(page.locator('.q-verdict.is-bad')).toContainText('Not quite — it’s a debit.');
  const answers: Array<[string, string]> = [
    ['increase Loan to a Friend', 'Debit'],
    ['increase Car Loan Payable', 'Credit'],
    ['increase Interest Income', 'Credit'],
    ['decrease Cash', 'Credit'],
    ['increase Bank Fees Expense', 'Debit'],
  ];
  for (const [g, side] of answers) await page.getByRole('group', { name: g }).getByRole('radio', { name: side }).check();
  await expect(page.locator('.q-verdict.is-ok')).toHaveCount(5);
  await expect(page.getByRole('complementary', { name: 'Key concept' })).toBeVisible();
});

test('equation-fill: wrong then right', async ({ page }) => {
  await page.goto('/#/p/03-review-equation');
  await page.getByLabel('Item 1: missing Assets').fill('1');
  await check(page).click();
  await expect(headline(page)).toContainText(/issues? found/);
  await page.getByLabel('Item 1: missing Assets').fill('4500');
  await page.getByLabel('Item 2: missing Equity').fill('2800');
  await page.getByLabel('Item 3: missing Assets').fill('3700');
  await check(page).click();
  await expect(headline(page)).toContainText('Correct!');
});

test('statement-fill: wrong then right', async ({ page }) => {
  await page.goto('/#/p/03-month-balance-sheet');
  await page.getByLabel('Cash amount').fill('1');
  await check(page).click();
  await expect(headline(page)).toContainText(/issues? found/);
  await page.getByLabel('Cash amount').fill('40');
  await page.getByLabel('Checking Account amount').fill('660');
  await page.getByLabel('Savings Account amount').fill('300');
  await page.getByLabel('Net Worth amount').fill('1000');
  await check(page).click();
  await expect(headline(page)).toContainText('Correct!');
});

test('classify: select-then-place with the keyboard, wrong then right', async ({ page }) => {
  await page.goto('/#/p/01-classify-your-accounts');
  // A chip may be in the pool or already in a bucket; selecting it and pressing "Place here" moves it.
  const place = async (item: string, bucket: string) => {
    await page.getByRole('button', { name: new RegExp(`^${item}( \\(|$)`) }).click();
    await page.getByRole('group', { name: `${bucket} bucket` }).getByRole('button', { name: 'Place here' }).click();
  };
  const right: Array<[string, string]> = [
    ['Cash', 'Asset'],
    ['Car', 'Asset'],
    ['Credit Card Payable', 'Liability'],
    ['Net Worth', 'Equity'],
    ['Salary Income', 'Revenue'],
    ['Rent Expense', 'Expense'],
  ];
  await place('Cash', 'Liability');
  await check(page).click();
  await expect(headline(page)).toContainText(/issues? found/);
  for (const [i, b] of right) await place(i, b);
  await check(page).click();
  await expect(headline(page)).toContainText('Correct!');
});

test('cheat sheet drawer: opens, traps focus, Esc closes and restores focus', async ({ page }) => {
  await page.goto('/#/');
  const opener = page.getByRole('button', { name: 'Cheat sheet' });
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Cheat sheet' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: /Close cheat sheet/ })).toBeFocused();
  const inDrawer = () => page.evaluate(() => !!document.activeElement?.closest('.drawer'));
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    expect(await inDrawer()).toBe(true);
  }
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await inDrawer()).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test('theme toggle switches data-theme and persists across reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/#/');
  const html = page.locator('html');
  await page.getByRole('button', { name: 'Dark theme' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Dark theme' }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
});

test('animation steps with buttons and arrow keys', async ({ page }) => {
  await page.goto('/#/s/03-t-accounts');
  const anim = page.locator('.step-anim').first();
  const counter = anim.locator('.step-anim__counter');
  await expect(counter).toHaveText(/Step 1 of \d+/);
  await anim.getByRole('button', { name: 'Next step' }).click();
  await expect(counter).toHaveText(/Step 2 of/);
  await anim.getByRole('button', { name: 'Previous step' }).click();
  await expect(counter).toHaveText(/Step 1 of/);
  await anim.focus();
  await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText(/Step 2 of/);
  await page.keyboard.press('ArrowLeft');
  await expect(counter).toHaveText(/Step 1 of/);
});
