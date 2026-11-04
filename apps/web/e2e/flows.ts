import { expect, type Page } from '@playwright/test';

export async function signUp(page: Page, name: string) {
  await page.goto('/sign-up');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(`${name.toLowerCase()}@example.com`);
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create account' }).click();
}

export async function createBrandFromFixtureSite(page: Page): Promise<string> {
  await expect(page).toHaveURL(/\/brands\/new$/);
  await page.getByLabel('Brand name').fill('Sunrise Bakery');
  await page.getByLabel('Website (optional)').fill('http://localhost:4100');
  await page.getByRole('button', { name: 'Create brand' }).click();
  await expect(page).toHaveURL(/\/brands\/[^/]+\/dna$/, { timeout: 60_000 });
  await expect(page.getByLabel('Tagline')).toHaveValue('Fresh bread, baked before the sun is up.');
  return new URL(page.url()).pathname.split('/')[2]!;
}
