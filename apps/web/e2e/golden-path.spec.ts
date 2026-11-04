import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { createBrandFromFixtureSite, signUp } from './flows';

async function pickFirstModel(page: Page, label: string, submit: string) {
  await page.getByRole('combobox', { name: label }).click();
  await page.getByRole('option').first().click();
  await page.getByRole('button', { name: submit }).click();
}

test('signs up, learns a brand, plans content, exports it and chats', async ({ page }, testInfo) => {
  await signUp(page, 'Owner');

  await expect(page).toHaveURL(/\/setup$/);
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByLabel('OpenRouter API key').fill('sk-or-e2e-fake-key');
  await page.getByRole('button', { name: 'Verify and continue' }).click();
  await pickFirstModel(page, 'Brain model', 'Continue');
  await pickFirstModel(page, 'Image model', 'Finish setup');

  const brandId = await createBrandFromFixtureSite(page);

  await page.goto(`/brands/${brandId}/strategy`);
  await page.getByRole('checkbox', { name: 'Instagram' }).check();
  await page.getByRole('button', { name: 'Create my strategy' }).click();
  await expect(page.getByRole('heading', { name: 'Content pillars' })).toBeVisible({ timeout: 60_000 });

  await page.goto(`/brands/${brandId}/board`);
  const cards = page.locator('article');
  const cardsWithImages = cards.filter({ has: page.locator('img') });
  await expect.poll(() => cardsWithImages.count(), { timeout: 120_000 }).toBeGreaterThanOrEqual(3);
  await expect.poll(async () => (await cards.count()) - (await cardsWithImages.count()), { timeout: 120_000 }).toBe(0);
  await expect
    .poll(() => page.evaluate(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0)))
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath('board.png') });

  await cardsWithImages.first().getByRole('link').click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Approve' }).click();
  await expect(sheet.getByRole('heading', { name: 'Scheduled' })).toBeVisible();

  await sheet.getByRole('button', { name: 'Export ZIP' }).click();
  const downloading = page.waitForEvent('download');
  await sheet.getByRole('link', { name: 'Download ZIP' }).click({ timeout: 60_000 });
  const download = await downloading;
  const entries = Object.keys(unzipSync(new Uint8Array(await readFile(await download.path()))));
  expect(entries.some((entry) => entry.endsWith('/copy.txt'))).toBe(true);
  expect(entries.some((entry) => entry.endsWith('.png'))).toBe(true);

  await sheet.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Ask Lumo' }).click();
  await page.getByLabel('Message Lumo').fill('Which post should go out first?');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('list', { name: 'Messages' })).toContainText(
    'You asked: "Which post should go out first?"',
    { timeout: 60_000 },
  );
});
