import { expect, test } from '@playwright/test';
import { createBrandFromFixtureSite, signUp } from './flows';

test('shows a failed image with its error and recovers on retry', async ({ page }) => {
  await signUp(page, 'Member');
  const brandId = await createBrandFromFixtureSite(page);

  await page.goto(`/brands/${brandId}/studio`);
  await page.getByLabel('What should Lumo make? (optional)').fill('A teaser for the new loaf #fail-once');
  await page.getByRole('button', { name: 'Fewer variants' }).click();
  await page.getByRole('button', { name: 'Generate' }).click();

  const card = page.getByRole('region', { name: 'Made in the studio' }).locator('article');
  await expect(card.getByText('invalid_output')).toBeVisible({ timeout: 60_000 });
  await expect(card.locator('img')).toHaveCount(0);

  await card.getByRole('button', { name: 'Retry' }).click();
  await expect(card.locator('img')).toBeVisible({ timeout: 60_000 });
  await expect(card.getByText('invalid_output')).toBeHidden();
});
