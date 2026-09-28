import { expect, test } from '@playwright/test';

test('social sign-in states expose exact broker routes and explain pending access', async ({ page }) => {
  await page.route('**/api/me', route => route.fulfill({ status: 401, json: { detail: 'Sign in' } }));
  let configured = false;
  await page.route('**/api/auth/providers', route => route.fulfill({ json: { providers: [
    { id: 'google', name: 'Google', configured }, { id: 'github', name: 'GitHub', configured },
  ] } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page).toHaveTitle('Prooflane · Evidence Console');
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Continue with GitHub' })).toBeDisabled();
  await page.getByText('Set up Google or GitHub sign-in', { exact: true }).click();
  await expect(page.getByText('GOOGLE_CLIENT_ID', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  configured = true;
  await page.goto('/?access=pending');
  await expect(page.getByRole('status')).toContainText('Your identity was verified');
  await expect(page.getByRole('link', { name: 'Continue with Google' })).toHaveAttribute('href', '/api/auth/login?provider=google');
  await expect(page.getByRole('link', { name: 'Continue with GitHub' })).toHaveAttribute('href', '/api/auth/login?provider=github');
  await expect(page.getByRole('link', { name: 'Sign in to your workspace' })).toHaveAttribute('href', '/api/auth/login');
  await page.unroute('**/api/auth/providers');
  await page.route('**/api/auth/providers', route => route.fulfill({ status: 503 }));
  await page.goto('/');
  await expect(page.getByText('Social sign-in is unavailable.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in to your workspace' })).toBeVisible();
});
