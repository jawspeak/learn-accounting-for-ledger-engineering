import { expect, test } from '@playwright/test';
import { watchErrors } from './helpers';

test('a defined term opens its definition on click, links on, and closes with Esc', async ({
  page,
}) => {
  const w = watchErrors(page);
  await page.goto('/#/s/07-revenue-expenses');
  const term = page.locator('.gloss-term', { hasText: 'Retained Earnings' }).first();
  await term.click();
  const pop = page.getByRole('dialog', { name: 'Definition: Retained Earnings' });
  await expect(pop).toBeVisible();
  await expect(term).toHaveAttribute('aria-expanded', 'true');
  // A term inside the definition switches to that term.
  await pop.locator('.gloss-term', { hasText: 'equity' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Definition: Equity' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Keyboard: Enter on the focused term opens it.
  await term.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Definition: Retained Earnings' })).toBeVisible();
  await page.getByRole('link', { name: /All definitions/ }).click();
  await expect(page).toHaveURL(/#\/definitions\/retained-earnings/);
  await expect(page.locator('#def-retained-earnings')).toBeVisible();
  w.assertClean();
});

test('definitions page lists and filters every term', async ({ page }) => {
  await page.goto('/#/definitions');
  await expect(page.getByRole('heading', { name: 'Definitions', level: 1 })).toBeVisible();
  const all = await page.locator('.defs-item').count();
  expect(all).toBeGreaterThan(40);
  await page.getByPlaceholder(/Filter/).fill('contra');
  await expect(page.locator('.defs-item').first()).toBeVisible();
  expect(await page.locator('.defs-item').count()).toBeLessThan(all);
});

test.describe('phone', () => {
  // Phone-sized touch screen (iPhone 13 metrics) on the default browser.
  test.use({
    viewport: { width: 390, height: 664 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  });
  test('tapping a term opens a bottom sheet that fits the screen; tap outside closes it', async ({
    page,
  }) => {
    await page.goto('/#/s/09-contra');
    const term = page.locator('.gloss-term').first();
    await term.tap();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveClass(/is-sheet/);
    const vp = page.viewportSize()!;
    // It slides up from below; measure once it has settled.
    await expect
      .poll(async () => {
        const b = (await sheet.boundingBox())!;
        return Math.round(b.y + b.height);
      })
      .toBeLessThanOrEqual(vp.height);
    const box = (await sheet.boundingBox())!;
    expect(Math.round(box.x + box.width)).toBeLessThanOrEqual(vp.width);
    await page.locator('.gloss-backdrop').tap({ position: { x: 20, y: 40 } });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // And the page itself never scrolls sideways.
    expect(await page.evaluate(() => window.innerWidth)).toBe(vp.width);
  });
});
