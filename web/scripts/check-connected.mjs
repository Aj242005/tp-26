// Exercises real services using a synthetic configuration; leaves the audit for review.
import { chromium, expect } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const origin = process.argv[2];
if (!origin || new URL(origin).protocol !== 'https:') throw new Error('Pass the connected HTTPS application origin');
const envFile = process.env.PROOFLANE_ENV_FILE || '../.env';
const env = Object.fromEntries(readFileSync(envFile, 'utf8').split(/\r?\n/)
  .filter(line => /^[A-Z_]+=/.test(line)).map(line => {
    const at = line.indexOf('=');
    return [line.slice(0, at), line.slice(at + 1).replace(/^['"]|['"]$/g, '')];
  }));
if (!env.LOCAL_ADMIN_PASSWORD) throw new Error('Configure the workspace admin password in the private environment file');
const output = resolve('../runtime/cloud/checks');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let phase = 'public routes';
const result = { origin, checkedAt: new Date().toISOString(), checks: [] };
try {
  const context = await browser.newContext({ baseURL: origin, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.name));
  for (const [path, status] of [['/api/health/ready', 200], ['/api/me', 401], ['/api/metrics', 404], ['/auth/admin/', 404]]) {
    const response = await page.request.get(path);
    expect(response.status()).toBe(status);
  }
  result.checks.push('HTTPS readiness and private-route denial');
  phase = 'workspace sign-in';
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in to your workspace' }).click();
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill(env.LOCAL_ADMIN_PASSWORD);
  await page.locator('#kc-login').click();
  await expect(page.getByRole('navigation')).toBeVisible({ timeout: 45_000 });
  const me = await (await page.request.get('/api/me')).json();
  expect(me.roles).toContain('admin');
  const session = (await context.cookies()).find(cookie => cookie.name === 'sih_session');
  expect(session?.secure && session?.httpOnly).toBe(true);
  result.checks.push('OIDC sign-in and secure session cookie');
  phase = 'configuration upload';
  await page.goto('/devices');
  await page.getByRole('button', { name: 'Add configurations' }).click();
  await page.getByLabel('Configuration files').setInputFiles(resolve('../fixtures/ios-review.cfg'));
  await page.getByLabel('This is a complete configuration snapshot.').check();
  await page.getByRole('button', { name: 'Upload configurations', exact: true }).click();
  await expect(page.getByText('1 configuration preserved.', { exact: false })).toBeVisible();
  result.checks.push('Browser upload to encrypted object storage');
  phase = 'durable audit';
  await page.getByRole('button', { name: /Run audit/i }).first().click();
  await page.waitForURL(/\/audits\/[^/]+$/);
  const id = new URL(page.url()).pathname.split('/').pop();
  await expect.poll(async () => (await (await page.request.get('/api/audits/' + id)).json()).status,
    { timeout: 90_000, intervals: [2000, 3000] }).toBe('complete');
  const audit = await (await page.request.get('/api/audits/' + id)).json();
  expect(audit.findings.length).toBeGreaterThan(0);
  result.auditId = id;
  result.checks.push('Durable worker completed real audit');
  phase = 'evidence trail';
  await page.reload();
  await page.getByRole('tab', { name: '3D audit trail' }).click();
  await expect(page.getByRole('region', { name: 'Interactive audit trail' })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: resolve(output, 'audit.png'), fullPage: true });
  result.checks.push('3D audit trail rendered');
  phase = 'report and CSRF';
  const pdf = await page.request.get(`/api/audits/${id}/export/pdf`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
  expect((await page.request.post('/api/audits', { data: { device_id: audit.device_id } })).status()).toBe(403);
  result.checks.push('PDF report and CSRF rejection');
  phase = 'workspace routes';
  for (const route of ['/policies', '/sources', '/training', '/administration']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  result.checks.push('Workspace navigation, mobile layout and no page errors');
  await page.request.post('/api/auth/logout', { headers: { 'X-CSRF-Token': me.csrf } });
  expect((await page.request.get('/api/me')).status()).toBe(401);
  result.success = true;
} catch (error) {
  // Do not log identity URLs, environment values or browser state on failure.
  result.success = false;
  result.failedPhase = phase;
  result.errorType = error.name;
  process.exitCode = 1;
} finally {
  await browser.close();
  writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
