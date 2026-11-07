import { expect, type Page } from '@playwright/test';

/** Collect console errors and uncaught page errors; call `.assertClean()` at the end of a test. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  return {
    errors,
    assertClean: () => expect(errors, errors.join('\n')).toEqual([]),
  };
}

/** Add a T-account using the keyboard only: focus "Add account", pick type radio, type name, Enter. */
export async function addAccountByKeyboard(page: Page, typeLabel: string, search: string) {
  const add = page.getByRole('button', { name: /Add account/ });
  await add.focus();
  await page.keyboard.press('Enter');
  const group = page.getByRole('group', { name: 'Add a T-account' });
  await expect(group).toBeVisible();
  const radio = group.getByRole('radio', { name: typeLabel, exact: true });
  await radio.focus();
  await page.keyboard.press('Space');
  const combo = group.getByRole('combobox');
  await expect(combo).toBeFocused();
  await page.keyboard.type(search);
  await page.keyboard.press('Enter');
  await expect(group).toBeHidden();
}

export const BOOKING = '/#/p/03-cash-to-checking';

/** Fill the correct answer for 03-cash-to-checking: Dr Checking 100, Cr Cash 100. */
export async function enterCorrectCashToChecking(page: Page) {
  await addAccountByKeyboard(page, 'Asset', 'Checking Account');
  await addAccountByKeyboard(page, 'Asset', 'Cash');
  await page.getByRole('textbox', { name: 'Row 1 Checking Account Dr' }).fill('100');
  await page.getByRole('textbox', { name: 'Row 1 Cash Cr' }).fill('100');
}
