import { expect, test } from '@playwright/test';
import { watchErrors } from './helpers';

async function sectionHrefs(page: import('@playwright/test').Page) {
  await page.goto('/#/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  return page
    .getByRole('navigation', { name: 'Sections' })
    .locator('a[href^="#/s/"]')
    .evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
}

test('every route renders without console or page errors', async ({ page }) => {
  const w = watchErrors(page);
  const hrefs = await sectionHrefs(page);
  expect(hrefs.length).toBeGreaterThanOrEqual(13);

  for (const h of hrefs) {
    await page.goto(`/${h}`);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('main')).not.toContainText('Unknown section');
  }
  await page.goto('/#/cheatsheet');
  await expect(page.locator('main h1, main h2').first()).toBeVisible();
  await page.goto('/#/sandbox');
  await expect(page.getByRole('textbox', { name: 'Board title' })).toBeVisible();
  await page.goto('/#/sheet');
  await expect(page.getByRole('region', { name: /Spreadsheet/ })).toBeVisible();
  await page.goto('/#/animations');
  await expect(page.getByRole('heading', { name: 'Animation gallery', level: 1 })).toBeVisible();
  await page.goto('/#/nope/nothing');
  await expect(page.getByText('Page not found')).toBeVisible();
  w.assertClean();
});

test('every problem page of every section renders without errors', async ({ page }) => {
  const w = watchErrors(page);
  const hrefs = await sectionHrefs(page);
  const problemHrefs = new Set<string>();
  for (const h of hrefs) {
    await page.goto(`/${h}`);
    await expect(page.locator('main h1')).toBeVisible();
    const found = await page.locator('main a[href^="#/p/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
    found.forEach((f) => problemHrefs.add(f.split('?')[0]!));
  }
  expect(problemHrefs.size).toBeGreaterThan(20);
  for (const h of problemHrefs) {
    await page.goto(`/${h}`);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('main')).not.toContainText('Unknown problem');
  }
  w.assertClean();
});

test('tablet width: routes render without horizontal page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1000 });
  const w = watchErrors(page);
  await page.goto('/#/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  for (const r of ['/#/s/03-t-accounts', '/#/p/03-cash-to-checking', '/#/sandbox']) {
    await page.goto(r);
    await expect(page.locator('main')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, r).toBeLessThanOrEqual(1);
  }
  w.assertClean();
});
