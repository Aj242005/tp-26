import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://127.0.0.1:4190';
const browser = await chromium.launch();
const issues = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', error => issues.push(error.message));
  page.on('console', message => { if (message.type() === 'error') issues.push(message.text()); });
  page.on('request', request => {
    if (/\/(?:api|auth)(?:\/|$)/.test(new URL(request.url()).pathname)) issues.push('Unexpected backend request');
  });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    for (const route of ['/', '/devices', '/audits/example?view=trail']) {
      const response = await page.goto(base + route);
      assert.equal(response.status(), 200);
      await page.getByRole('heading', { name: /Every finding/ }).waitFor();
      assert.match(await page.getByRole('status').innerText(), /Backend connection pending/);
      assert.equal(await page.locator('a[href^="/api"]').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
  }
  await mkdir('../runtime/vercel', { recursive: true });
  await page.screenshot({ path: '../runtime/vercel/mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(base);
  await page.getByRole('status').waitFor();
  await page.screenshot({ path: '../runtime/vercel/desktop.png', fullPage: true });
  assert.deepEqual(issues, []);
  console.log('Frontend preview passed: three routes at three widths; no backend calls, overflow or browser errors.');
} finally {
  await browser.close();
}
