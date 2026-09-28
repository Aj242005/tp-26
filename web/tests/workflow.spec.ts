import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve('..');
const env = Object.fromEntries(readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)
  .filter(line => /^[A-Z_]+=/.test(line)).map(line => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1).replace(/^['"]|['"]$/g, '')]; }));
mkdirSync(resolve(root, 'runtime/screenshots'), { recursive: true });

async function login(page: Page, username = 'admin') {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in to your workspace' }).click();
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(env[`LOCAL_${username.toUpperCase()}_PASSWORD`]);
  await page.locator('#kc-login').click();
  await expect(page.getByRole('navigation')).toBeVisible({ timeout: 40_000 });
  const response = await page.request.get('/api/me');
  expect(response.status()).toBe(200);
  return (await response.json()).csrf as string;
}

async function mutation(request: APIRequestContext, path: string, csrf: string, data: unknown = {}, extra: Record<string, string> = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await request.post('/api' + path, { data, headers: { 'X-CSRF-Token': csrf, ...extra } });
    if (response.status() !== 429) return response;
    await new Promise(resolve => setTimeout(resolve, Number(response.headers()['retry-after'] || 3) * 1000));
  }
  throw new Error('Mutation quota did not recover');
}

async function audit(request: APIRequestContext, csrf: string, deviceId: string) {
  const key = crypto.randomUUID();
  const response = await mutation(request, '/audits', csrf, { device_id: deviceId }, { 'Idempotency-Key': key });
  expect(response.status()).toBe(202);
  const { id } = await response.json();
  const replay = await mutation(request, '/audits', csrf, { device_id: deviceId }, { 'Idempotency-Key': key });
  expect((await replay.json()).id).toBe(id);
  await expect.poll(async () => (await (await request.get('/api/audits/' + id)).json()).status,
    { timeout: 75_000, intervals: [2000, 3000] }).toBe('complete');
  return (await (await request.get('/api/audits/' + id)).json());
}

test('real identity, encrypted upload, deterministic audit, mapping review/rollback, tenant and role isolation', async ({ page, browser }) => {
  const csrf = await login(page);
  const created = await mutation(page.request, '/examples', csrf);
  expect(created.status()).toBe(201);
  const devices = (await created.json()).items;
  const unknown = devices.find((item: { vendor: string }) => item.vendor === 'unknown');
  expect(unknown).toBeTruthy();
  const before = await audit(page.request, csrf, unknown.id);
  expect(before.findings.find((item: { id: string }) => item.id === 'AC-04').verdict).toBe('insufficient_evidence');
  const mapping = { name: 'Synthetic unfamiliar SSH mapping', vendor: 'unknown', firmware: 'unknown', fact: 'ssh_version',
    selector_type: 'line_prefix', selector: 'secure-shell-version', value_mode: 'last_token', value_type: 'integer',
    description: 'Team-authored synthetic semantics; local workflow test only.', cases: [
      { text: 'secure-shell-version 2', expected: 2, label_source: 'Team synthetic fixture' },
      { text: 'secure-shell-version 1', expected: 1, label_source: 'Team synthetic fixture' },
      { text: 'secure-shell-version-extra 2', expected: null, label_source: 'Team synthetic negative case' },
    ] };
  const draft = await mutation(page.request, '/mappings', csrf, mapping);
  expect(draft.status()).toBe(201);
  const map = await draft.json();
  expect(map.tests.passed).toBe(true);
  expect((await mutation(page.request, `/mappings/${map.id}/activate`, csrf)).status()).toBe(200);
  const after = await audit(page.request, csrf, unknown.id);
  expect(after.findings.find((item: { id: string }) => item.id === 'AC-04').verdict).toBe('pass');
  expect(after.coverage).toBeGreaterThan(before.coverage);
  // Prior reports remain immutable after mapping activation.
  expect((await (await page.request.get('/api/audits/' + before.id)).json()).coverage).toBe(before.coverage);
  const pdf = await page.request.get(`/api/audits/${after.id}/export/pdf`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
  expect((await page.request.post('/api/audits', { data: { device_id: unknown.id } })).status()).toBe(403);
  expect((await page.request.post('/api/mappings', { data: mapping, headers: { 'X-CSRF-Token': csrf, Origin: 'https://untrusted.invalid' } })).status()).toBe(403);

  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await login(otherPage, 'other');
  expect((await otherPage.request.get('/api/audits/' + after.id)).status()).toBe(404);
  expect((await otherPage.request.get(`/api/audits/${after.id}/export/pdf`)).status()).toBe(404);
  expect((await otherPage.request.get(`/api/devices/${unknown.id}/configuration?original=true`)).status()).toBe(404);
  await otherContext.close();
  const auditorContext = await browser.newContext();
  const auditorPage = await auditorContext.newPage();
  const auditorCsrf = await login(auditorPage, 'auditor');
  expect((await mutation(auditorPage.request, `/mappings/${map.id}/activate`, auditorCsrf)).status()).toBe(403);
  expect((await auditorPage.request.get('/api/events')).status()).toBe(403);
  await auditorContext.close();

  await page.goto('/audits/' + after.id);
  await expect(page.getByRole('heading', { name: unknown.name, exact: true })).toBeVisible();
  await page.screenshot({ path: resolve(root, 'runtime/screenshots/audit-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(root, 'runtime/screenshots/audit-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/training');
  await expect(page.getByRole('heading', { name: /mapping|training/i }).first()).toBeVisible();
  await page.screenshot({ path: resolve(root, 'runtime/screenshots/training-desktop.png'), fullPage: true });
  expect((await mutation(page.request, `/mappings/${map.id}/retire`, csrf)).status()).toBe(200);
  const rolledBack = await audit(page.request, csrf, unknown.id);
  expect(rolledBack.findings.find((item: { id: string }) => item.id === 'AC-04').verdict).toBe('insufficient_evidence');
  const logout = await mutation(page.request, '/auth/logout', csrf);
  expect(logout.status()).toBe(200);
  expect((await page.request.get('/api/me')).status()).toBe(401);
});

test('browser upload and navigation use persisted services; public metrics are blocked', async ({ page }) => {
  await login(page);
  await page.goto('/devices');
  await page.getByRole('button', { name: 'Add configurations' }).click();
  await page.getByLabel('Configuration files').setInputFiles(resolve(root, 'fixtures/ios-review.cfg'));
  await page.getByLabel('This is a complete configuration snapshot.').check();
  await page.getByRole('button', { name: 'Upload configurations', exact: true }).click();
  await expect(page.getByText('1 configuration preserved.', { exact: false })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  await page.screenshot({ path: resolve(root, 'runtime/screenshots/devices-desktop.png'), fullPage: true });
  expect((await page.request.get('/api/metrics')).status()).toBe(404);
  for (const route of ['/policies', '/sources', '/administration']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});
