import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('configured Gemini investigates synthetic unknown syntax and persists review-only proposals', async ({ page }) => {
  test.setTimeout(240_000);
  const env = Object.fromEntries(readFileSync(resolve('../.env'), 'utf8').split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line))
    .map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')]; }));
  test.skip(env.LLM_ENABLED !== 'true', 'Live Gemini check requires explicitly enabled provider configuration');
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in to your workspace' }).click();
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill(env.LOCAL_ADMIN_PASSWORD);
  await page.locator('#kc-login').click();
  await expect(page.getByRole('navigation')).toBeVisible({ timeout: 40_000 });
  const me = await (await page.request.get('/api/me')).json();
  expect(me.ai.configured).toBe(true);
  const headers = { 'X-CSRF-Token': me.csrf };
  const source = await page.request.post('/api/sources', { headers, data: {
    name: 'Synthetic qualification vendor reference', authority: 'Team-authored synthetic dialect', version: 'test-v1',
    permission: 'Authored for this application test; not a vendor dataset',
    content: 'Synthetic test dialect only: secure-shell-version N selects the SSH protocol version as an integer. Version 2 is the declared secure baseline. This command has device scope. A command whose prefix is secure-shell-version-extra is unrelated and does not establish an SSH version. No other native firmware semantics are specified by this synthetic document.' } });
  expect(source.status()).toBe(201);
  const records = await (await page.request.get('/api/records?kind=audit&page_size=100')).json();
  const candidate = records.items.find((row: { vendor: string; status: string }) => row.vendor === 'unknown' && row.status === 'complete');
  expect(candidate).toBeTruthy();
  const start = await page.request.post(`/api/audits/${candidate.id}/investigate`, { headers });
  expect(start.status()).toBe(200);
  await expect.poll(async () => (await (await page.request.get(`/api/audits/${candidate.id}`)).json()).status,
    { timeout: 210_000, intervals: [5000] }).toBe('waiting_review');
  const audit = await (await page.request.get(`/api/audits/${candidate.id}`)).json();
  expect(audit.investigation.model).toBe(env.GEMINI_MODEL);
  expect(audit.investigation.tokens).toBeGreaterThan(0);
  expect(audit.investigation.trace.length).toBeGreaterThan(0);
  const mappings = await (await page.request.get('/api/records?kind=mapping&page_size=100')).json();
  for (const draft of mappings.items.filter((row: { source_audit?: string }) => row.source_audit === candidate.id)) {
    expect(draft.status).toBe('draft');
  }
  await page.goto('/audits/' + candidate.id);
  await page.getByRole('tab', { name: 'Investigation' }).click();
  await expect(page.getByRole('heading', { name: 'Investigation summary' })).toBeVisible();
  await page.screenshot({ path: resolve('../runtime/screenshots/gemini-investigation.png'), fullPage: true });
});
