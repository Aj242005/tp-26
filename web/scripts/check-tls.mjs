// Local self-signed TLS qualification. No credentials or browser storage are persisted.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const env = Object.fromEntries(readFileSync('../.env', 'utf8').split(/\r?\n/)
  .filter(line => /^[A-Z_]+=/.test(line)).map(line => {
    const at = line.indexOf('=');
    return [line.slice(0, at), line.slice(at + 1).replace(/^['"]|['"]$/g, '')];
  }));
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ baseURL: 'https://localhost:8443', ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in to your workspace' }).click();
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill(env.LOCAL_ADMIN_PASSWORD);
  await page.locator('#kc-login').click();
  await page.getByRole('navigation').waitFor({ timeout: 45000 });
  const response = await page.request.get('/api/me');
  assert.equal(response.status(), 200);
  const session = (await context.cookies()).find(cookie => cookie.name === 'sih_session');
  assert.ok(session?.secure && session.httpOnly && session.sameSite === 'Lax');
  const redirect = await page.request.get('http://localhost:8185/', { maxRedirects: 0 });
  assert.equal(redirect.status(), 308);
  assert.equal(redirect.headers().location, 'https://localhost:8443/');
  const logout = await page.request.post('/api/auth/logout', { data: {}, headers: { 'X-CSRF-Token': (await response.json()).csrf } });
  assert.equal(logout.status(), 200);
  const result = { oidc_over_tls: true, secure_httponly_cookie: true, http_redirect: true,
    certificate: 'Self-signed localhost only; test context explicitly accepts this certificate' };
  writeFileSync('../runtime/tls-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
