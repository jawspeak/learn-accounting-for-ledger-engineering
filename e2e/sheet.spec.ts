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
