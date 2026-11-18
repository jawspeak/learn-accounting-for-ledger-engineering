import { expect, test } from '@playwright/test';
import { watchErrors } from './helpers';

test.use({ viewport: { width: 1600, height: 950 } });

test('spreadsheet view: example, keyboard entry, posted vs pending, URL restore, open in sandbox', async ({
  page,
}) => {
  const w = watchErrors(page);
  await page.goto('/#/sheet');
  await page.locator('.sh-toolbar select').selectOption('payroll');
  await expect(page.locator('.sh-checks')).toContainText('Every row balances');

  // Pending payouts: posted cash $2,020, pending cash $20.
  const cashDebit = (row: string) => page.locator(`tr.${row} td`).first();
  await expect(cashDebit('sh-balance:not(.sh-balance-pending)')).toHaveText('$2,020');
  await expect(cashDebit('sh-balance-pending')).toHaveText('$20');

  // Keyboard: event text → → pending → → Cash debit → → Cash credit; Enter moves down.
  await page.getByRole('textbox', { name: 'Row 5 event' }).click();
  await page.keyboard.type('Fee sweep');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('checkbox', { name: 'Row 5 pending' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
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

  // Attributes must be JSON.
  const meta = page.getByRole('textbox', { name: 'Operating Cash attributes (JSON)' });
  await meta.fill('{ "type": ');
  await expect(page.getByText('Not valid JSON')).toBeVisible();
  await meta.fill('{ "type": "operating_cash" }');
  await expect(page.getByText('Not valid JSON')).toBeHidden();

  // The URL carries everything.
  await expect(page).toHaveURL(/#\/sheet\?d=/);
  await page.waitForTimeout(500); // debounced URL write
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Row 5 event' })).toHaveValue('Fee sweep');
  await expect(page.getByRole('textbox', { name: 'Operating Cash attributes (JSON)' })).toHaveValue(
    '{ "type": "operating_cash" }',
  );
  await expect(page.getByRole('checkbox', { name: 'Row 3 pending' })).toBeChecked();

  // Other books, then the same state in the sandbox.
  await page.locator('.sh-books select').selectOption({ label: 'Employer Foo' });
  await expect(page.getByRole('textbox', { name: 'Account name: Payroll Payable' })).toBeVisible();
  await expect(page).toHaveURL(/e=1/);
  await page.getByRole('link', { name: 'Open in Sandbox' }).click();
  await expect(page.getByRole('textbox', { name: 'Board title' })).toHaveValue('Payroll');
  w.assertClean();
});
