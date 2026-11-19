import { expect, test } from '@playwright/test';
import { watchErrors } from './helpers';

test.use({ viewport: { width: 1600, height: 950 } });

test('spreadsheet view: example, keyboard entry, ▲ sides, party tabs, URL restore, switch view', async ({
  page,
}) => {
  const w = watchErrors(page);
  await page.goto('/#/sheet');
  await page.locator('.sh-toolbar select').selectOption('payroll');
  await expect(page.locator('.sh-checks')).toContainText('Every row balances');

  // One balance row: every row counts (no pending state). Cash keeps the $20 fee.
  await expect(page.locator('tr.sh-balance td').first()).toHaveText('$20');
  await expect(page.locator('tr.sh-balance')).toHaveCount(1);
  // No pending column, attributes JSON or normal-balance row; ▲ marks the side that increases.
  await expect(page.getByRole('columnheader', { name: 'Pending' })).toHaveCount(0);
  await expect(page.locator('.sh-grid').getByText('Attributes (JSON)')).toHaveCount(0);
  await expect(page.locator('.sh-grid').getByText('Normal balance')).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Cash debit (increases)' })).toContainText(
    '▲',
  );
  await expect(
    page.getByRole('columnheader', { name: 'Cash credit', exact: true }),
  ).not.toContainText('▲');
  await expect(
    page.getByRole('columnheader', { name: /Foo Employee 1 Payable credit \(increases\)/ }),
  ).toContainText('▲');

  // Keyboard: event text → Cash debit → Cash credit; Enter moves down.
  await page.getByRole('textbox', { name: 'Row 5 event' }).click();
  await page.keyboard.type('Fee sweep');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('textbox', { name: 'Row 5 Cash debit' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('textbox', { name: 'Row 5 Cash credit' })).toBeFocused();
  await page.keyboard.type('20');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Row 6 Cash credit' })).toBeFocused();
  await expect(page.locator('.sh-checks')).toContainText('Unbalanced: row 5');

  // A new account lands with focus in its first debit cell.
  await page.getByRole('textbox', { name: 'New account name' }).fill('Operating Cash');
  await page.getByRole('button', { name: '＋ Add' }).click();
  await expect(page.getByRole('textbox', { name: 'Row 1 Operating Cash debit' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Row 5 Operating Cash debit' }).fill('20');
  await expect(page.locator('.sh-checks')).toContainText('Every row balances');

  // The URL carries everything.
  await expect(page).toHaveURL(/#\/sheet\?d=/);
  await page.waitForTimeout(500); // debounced URL write
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Row 5 event' })).toHaveValue('Fee sweep');

  // Parties are tabs: click or arrow keys; the URL remembers which.
  const tabs = page.getByRole('tablist', { name: 'Whose books' });
  await expect(tabs.getByRole('tab', { name: 'Payroll provider' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await tabs.getByRole('tab', { name: 'Employer Foo' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Employer Foo' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Account name: Payroll Payable' })).toBeVisible();
  await expect(page).toHaveURL(/e=1/);
  await page.keyboard.press('ArrowLeft');
  await expect(tabs.getByRole('tab', { name: 'Payroll provider' })).toBeFocused();
  await expect(tabs.getByRole('tab', { name: 'Payroll provider' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: '+ Add party' }).click();
  await expect(tabs.getByRole('tab')).toHaveCount(3);
  await expect(tabs.getByRole('tab').nth(2)).toHaveAttribute('aria-selected', 'true');

  // The same scenario in the T-accounts view, via the shared switcher.
  const views = page.getByRole('navigation', { name: 'Sandbox view' });
  await expect(views.getByRole('link', { name: 'Spreadsheet' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await views.getByRole('link', { name: 'T-accounts' }).click();
  await expect(page.getByRole('textbox', { name: 'Board title' })).toHaveValue('Payroll');
  await expect(
    page
      .getByRole('navigation', { name: 'Sandbox view' })
      .getByRole('link', { name: 'T-accounts' }),
  ).toHaveAttribute('aria-current', 'page');
  w.assertClean();
});

test('T-accounts view: no Dr / Cr words, ▲ on the side that increases', async ({ page }) => {
  await page.goto('/#/sandbox');
  await page.getByRole('combobox', { name: /Example scenarios/ }).selectOption('loan');
  const sides = page.locator('.sbx-entity').first().locator('tr.tab-sides th');
  await expect(sides.first()).toBeVisible();
  const text = (await sides.allInnerTexts()).join(' ');
  expect(text).not.toMatch(/\b(Dr|Cr)\b/);
  expect(text).toContain('▲');
  // A problem page keeps Dr / Cr (the vocabulary is part of the exercise).
  await page.goto('/#/p/03-pay-rent'); // a faded example: its columns are pre-filled
  await expect(page.locator('tr.tab-sides th').first()).toBeVisible();
  expect((await page.locator('tr.tab-sides th').allInnerTexts()).join(' ')).toMatch(/Dr/);
});

test('both views share cents, the account order (auto / manual) and the rows', async ({ page }) => {
  const w = watchErrors(page);
  await page.goto('/#/sheet');
  await page.locator('.sh-toolbar select').selectOption('payroll');

  // Cents.
  await page.getByRole('textbox', { name: 'Row 5 event' }).fill('Bank fee');
  await page.getByRole('textbox', { name: 'Row 5 Cash credit' }).fill('44.24');
  await expect(page.getByRole('textbox', { name: 'Row 5 Cash credit' })).toHaveValue('44.24');
  await page.getByRole('textbox', { name: 'Row 5 Fee Revenue debit' }).fill('44.24');
  await page.getByRole('textbox', { name: 'Row 5 event' }).click(); // blur: shows as money
  await expect(page.getByRole('textbox', { name: 'Row 5 Cash credit' })).toHaveValue('$44.24');
  await expect(page.locator('.sh-checks')).toContainText('Every row balances');

  // Auto order: no ◀ ▶. Manual: ◀ ▶ appear and move columns.
  const order = page.getByRole('group', { name: 'Account order' });
  await expect(order.getByRole('button', { name: /Auto/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Move Cash right' })).toHaveCount(0);
  await order.getByRole('button', { name: 'Manual' }).click();
  await page.getByRole('button', { name: 'Move Cash right' }).click();
  const sheetHeads = page.locator('.sh-names .sh-name');
  await expect(sheetHeads.nth(0)).toHaveValue('Employer Foo Receivable');
  await expect(sheetHeads.nth(1)).toHaveValue('Cash');

  // Rows: move "Bank fee" (row 5) up to row 4.
  await page.getByRole('textbox', { name: 'Row 5 event' }).hover();
  await page.getByRole('button', { name: 'Move row 5 up' }).click();
  await expect(page.getByRole('textbox', { name: 'Row 4 event' })).toHaveValue('Bank fee');

  // The T-accounts view shows the same: manual order (with ◀ ▶), same columns, same rows, cents.
  await page.waitForTimeout(400); // debounced URL write
  await page
    .getByRole('navigation', { name: 'Sandbox view' })
    .getByRole('link', { name: 'T-accounts' })
    .click();
  const card = page.locator('.sbx-entity').first();
  await expect(
    card.getByRole('group', { name: 'Account order' }).getByRole('button', { name: 'Manual' }),
  ).toHaveAttribute('aria-pressed', 'true');
  const heads = card.locator('th[data-col-head]');
  await expect(heads.nth(0)).toHaveAttribute('data-col-head', 'employer-foo-receivable');
  await expect(heads.nth(1)).toHaveAttribute('data-col-head', 'cash');
  await expect(card.getByRole('button', { name: 'Move Cash left' })).toBeVisible();
  await expect(card.getByRole('textbox', { name: 'Row 4 label' })).toHaveValue('Bank fee');
  await expect(card.getByRole('textbox', { name: 'Row 4 Cash Cr' })).toHaveValue('44.24');
  // …and the Accounts panel lists them in that same order.
  await card.getByText(/^Accounts \(/).click();
  await expect(card.locator('.sbx-accounts tbody tr input').first()).toHaveValue(
    'Employer Foo Receivable',
  );

  // Back to auto: balance-sheet order, no ◀ ▶, Accounts panel grouped under headings.
  await card
    .getByRole('group', { name: 'Account order' })
    .getByRole('button', { name: /Auto/ })
    .click();
  await expect(heads.nth(0)).toHaveAttribute('data-col-head', 'cash');
  await expect(card.getByRole('button', { name: 'Move Cash left' })).toHaveCount(0);
  await expect(card.locator('.sbx-section-row').first()).toHaveText('Assets');

  // The picker lists only accounts of the chosen type.
  await card
    .locator('.tab-toolbar')
    .getByRole('button', { name: /Add account/ })
    .click();
  await card
    .getByRole('group', { name: 'Add a T-account' })
    .getByLabel('Liability', { exact: true })
    .check();
  const names = await card
    .getByRole('listbox', { name: 'Accounts' })
    .getByRole('option')
    .allTextContents();
  expect(names, names.join(' | ')).toEqual(names.filter((n) => /Payable/.test(n)));
  w.assertClean();
});
