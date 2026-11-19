import { expect, test, type Page } from '@playwright/test';
import { watchErrors } from './helpers';

test.use({ viewport: { width: 1600, height: 950 } });

const views = (page: Page) => page.getByRole('navigation', { name: 'Sandbox view' });
const loadExample = (page: Page, id: string) =>
  page.getByLabel('Example scenarios:').selectOption(id);

test('Grid: example, ▲ sides, keyboard entry, party tabs, URL restore', async ({ page }) => {
  const w = watchErrors(page);
  await page.goto('/#/sheet');
  await loadExample(page, 'payroll');
  await expect(page.locator('.sbx-summary')).toContainText('Rows balanced');

  // One balance row; ▲ marks the side that increases (no separate normal-balance row).
  await expect(page.locator('tr.sh-balance td').first()).toHaveText('$20');
  await expect(page.getByRole('columnheader', { name: 'Cash debit (increases)' })).toContainText(
    '▲',
  );
  await expect(
    page.getByRole('columnheader', { name: 'Cash credit', exact: true }),
  ).not.toContainText('▲');

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
  await expect(page.locator('.sbx-summary')).toContainText('Unbalanced row: 5');

  // Parties are tabs (shared with the Journal): click or arrow keys; the URL remembers which.
  const tabs = page.getByRole('tablist', { name: 'Whose books' });
  await tabs.getByRole('tab', { name: 'Employer Foo' }).click();
  await expect(page.getByRole('textbox', { name: 'Account name: Payroll Payable' })).toBeVisible();
  await expect(page).toHaveURL(/e=1/);
  await page.keyboard.press('ArrowLeft');
  await expect(tabs.getByRole('tab', { name: 'Payroll provider' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await page.waitForTimeout(500); // debounced URL write
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Row 5 event' })).toHaveValue('Fee sweep');
  w.assertClean();
});

test('Journal → T-accounts → Grid: the same books, three ways', async ({ page }) => {
  const w = watchErrors(page);
  await page.goto('/#/sandbox');
  await loadExample(page, 'loan');
  await expect(views(page).getByRole('link', { name: 'Journal' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  // Journal: add an entry with cents, choosing accounts by name.
  await page.getByRole('button', { name: /Add entry/ }).click();
  await expect(page.getByLabel('Entry 3 description')).toBeFocused();
  await page.keyboard.type('Bank fee');
  await page.getByLabel('Entry 3 line 1 account').selectOption({ label: 'Interest Expense' });
  await page.getByLabel('Entry 3 line 1 debit').fill('2.50');
  await page.getByLabel('Entry 3 line 2 account').selectOption({ label: 'Checking Account' });
  await expect(page.locator('#entry-3 .jx-status')).toContainText('≠');
  await page.getByLabel('Entry 3 line 2 credit').fill('2.50');
  await expect(page.locator('#entry-3 .jx-status')).toContainText('Debits = credits');

  // T-accounts: real T's for the accounts in use, numbered by entry; Checking ends at $492.50.
  await page.waitForTimeout(400);
  await views(page).getByRole('link', { name: 'T-accounts' }).click();
  await expect(page).toHaveURL(/#\/taccounts\?d=/);
  const you = page.getByRole('region', { name: 'You’s ledger' });
  const checking = you.getByRole('group', { name: /^Checking Account, asset T-account/ });
  await expect(checking).toHaveAttribute('aria-label', /balance \$492.50 debit/);
  await expect(checking.locator('.tacct__sides')).toContainText('Dr ▲');
  await expect(you.getByRole('group', { name: /^Cash,/ })).toHaveCount(0); // unused: no empty T's
  // An entry number goes back to that entry in the Journal.
  await checking.getByRole('link', { name: '(3)' }).click();
  await expect(page).toHaveURL(/#\/sandbox\?.*at=entry-3/);
  await expect(page.locator('#entry-3')).toBeInViewport();

  // Grid: the same three rows.
  await views(page).getByRole('link', { name: 'Grid' }).click();
  await expect(page.getByRole('textbox', { name: 'Row 3 event' })).toHaveValue('Bank fee');
  await expect(page.getByRole('textbox', { name: 'Row 3 Interest Expense debit' })).toHaveValue(
    '$2.50',
  );
  w.assertClean();
});

test('one account order and one set of rows across the views', async ({ page }) => {
  const w = watchErrors(page);
  await page.goto('/#/sheet');
  await loadExample(page, 'payroll');

  // Manual order in the Grid: ◀ ▶ appear; move Cash right.
  const order = page.getByRole('group', { name: 'Account order' });
  await expect(page.getByRole('button', { name: 'Move Cash right' })).toHaveCount(0);
  await order.getByRole('button', { name: 'Manual' }).click();
  await page.getByRole('button', { name: 'Move Cash right' }).click();
  await expect(page.locator('.sh-names .sh-name').nth(1)).toHaveValue('Cash');

  // Move row 4 up to row 3.
  await page.getByRole('textbox', { name: 'Row 4 event' }).hover();
  await page.getByRole('button', { name: 'Move row 4 up' }).click();
  await expect(page.getByRole('textbox', { name: 'Row 3 event' })).toHaveValue(
    'Credit Foo Employee 2',
  );

  // The T-accounts view follows the manual order; the Journal has the moved rows.
  await page.waitForTimeout(400);
  await views(page).getByRole('link', { name: 'T-accounts' }).click();
  const provider = page.getByRole('region', { name: 'Payroll provider’s ledger' });
  const firstT = provider.getByRole('group', { name: /T-account/ }).first();
  await expect(firstT).toHaveAttribute('aria-label', /^Employer Foo Receivable,/);
  await views(page).getByRole('link', { name: 'Journal' }).click();
  await expect(page.getByLabel('Entry 3 description')).toHaveValue('Credit Foo Employee 2');
  w.assertClean();
});
