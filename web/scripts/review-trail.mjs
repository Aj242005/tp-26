import { chromium, expect } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const base = process.argv[2] || 'http://localhost:8185';
const directory = '../runtime/audit-trail';
mkdirSync(directory, { recursive: true });
const env = Object.fromEntries(readFileSync('../.env', 'utf8').split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')]; }));
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const errors = [], violations = [], checks = [];
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1060 } });
  const page = await context.newPage();
  let nextRead = 0;
  await page.route('**/api/**', async route => {
    if (route.request().method() === 'GET' && !new URL(route.request().url()).pathname.startsWith('/api/auth/')) {
      const delay = Math.max(0, nextRead - Date.now()); nextRead = Math.max(nextRead, Date.now()) + 550;
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    }
    await route.continue();
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeFunction('reportCSP', message => violations.push(message));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', event => window.reportCSP(event.violatedDirective));
    window.trailDrawCalls = 0;
    if (window.WebGL2RenderingContext) {
      const draw = WebGL2RenderingContext.prototype.drawElements;
      WebGL2RenderingContext.prototype.drawElements = function (...args) { window.trailDrawCalls++; return draw.apply(this, args); };
    }
  });
  await page.goto('http://localhost:8185');
  await page.getByRole('link', { name: 'Sign in to your workspace' }).click();
  await page.locator('#username').fill('admin'); await page.locator('#password').fill(env.LOCAL_ADMIN_PASSWORD); await page.locator('#kc-login').click();
  await page.getByRole('navigation', { name: 'Main navigation' }).waitFor({ timeout: 45000 });
  const records = await (await context.request.get('http://localhost:8185/api/records?kind=audit&page_size=100')).json();
  const audit = records.items.find(row => row.synthetic && row.vendor === 'ios' && row.status === 'complete');
  const investigated = records.items.find(row => row.status === 'waiting_review');
  assert.ok(audit, 'A stored synthetic IOS audit is needed for this read-only check');
  const detail = await (await context.request.get(`http://localhost:8185/api/audits/${audit.id}`)).json();
  async function open(id = audit.id) {
    await page.goto(`${base}/audits/${id}`); await page.getByRole('tab', { name: '3D audit trail' }).click();
    await page.locator('.trail-canvas[data-ready="true"]').waitFor({ timeout: 30000 });
    await page.locator('.audit-trail').scrollIntoViewIfNeeded();
  }
  const rail = page.getByRole('group', { name: 'Select audit stage' });
  const inspector = page.getByRole('complementary', { name: 'Selected audit stage' });
  await open();
  await page.locator('.audit-trail').screenshot({ path: `${directory}/pipeline.png` });
  await page.screenshot({ path: `${directory}/desktop.png`, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const canvas = page.locator('.trail-canvas canvas');
  const before = await canvas.screenshot();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 35, { steps: 15 }); await page.mouse.up();
  assert.equal(before.equals(await canvas.screenshot()), false, 'Dragging should orbit the 3D scene');
  await page.getByRole('button', { name: 'Reset audit trail camera' }).click();
  await page.waitForTimeout(300);
  const idleDraws = await page.evaluate(() => window.trailDrawCalls);
  assert.ok(idleDraws > 0, 'The real WebGL scene must have drawn geometry');
  await page.waitForTimeout(1000);
  assert.equal(await page.evaluate(() => window.trailDrawCalls), idleDraws, 'An idle scene must not keep rendering');
  checks.push('WebGL rendering, orbit, camera reset and no page overflow');
  await page.locator('.trail-node-label').filter({ hasText: 'Policy' }).click();
  assert.equal(await inspector.getByRole('heading', { name: 'Policy snapshot' }).count(), 1);
  await rail.getByRole('button', { name: 'Inspect Configuration interpretation' }).click();
  await inspector.locator('details').first().locator('summary').click();
  await page.locator('.audit-trail').screenshot({ path: `${directory}/interpretation.png` });
  await rail.getByRole('button', { name: 'Inspect Input snapshot' }).focus(); await page.keyboard.press('End');
  assert.equal(await inspector.getByRole('heading', { name: 'Human review gate' }).count(), 1);
  await page.getByRole('button', { name: 'Replay trail', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.trail-stage-rail button.selected')?.textContent?.includes('Policy'));
  await page.getByRole('button', { name: 'Pause replay' }).click();
  const paused = await rail.locator('.selected').innerText(); await page.waitForTimeout(1950); assert.equal(await rail.locator('.selected').innerText(), paused);
  checks.push('Scene labels, keyboard stage selection and replay/pause');
  await rail.getByRole('button', { name: 'Inspect Rule evaluation' }).click();
  await page.getByRole('combobox', { name: 'Filter trail findings' }).selectOption('fail');
  await page.locator('.trail-finding-list button').first().click();
  await expect(page.getByRole('tab', { name: 'Findings & evidence' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: '3D audit trail' }).click(); await page.locator('.trail-canvas[data-ready="true"]').waitFor();
  await rail.getByRole('button', { name: 'Inspect Input snapshot' }).click(); await inspector.getByRole('button', { name: 'Open configuration' }).click();
  await page.locator('.full-configuration .code-line').first().waitFor();
  assert.match(await page.locator('.full-configuration .code-line').first().getAttribute('class'), /highlighted/);
  checks.push('Finding drill-down and exact source-line navigation');
  await open(); await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await page.locator('.audit-trail').screenshot({ path: `${directory}/light.png` });
  await page.goto(base);
  await page.locator('.control-tile').first().waitFor();
  await page.screenshot({ path: `${directory}/overview-light.png` });
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  if (investigated) {
    await open(investigated.id); await rail.getByRole('button', { name: 'Inspect Gemini investigation' }).click();
    await page.locator('.trail-tool summary').first().click();
    await page.locator('.audit-trail').screenshot({ path: `${directory}/investigation.png` });
    assert.equal(await inspector.evaluate(node => node.scrollWidth > node.clientWidth), false, 'Tool results must fit inside the inspector');
    assert.ok(await page.locator('.trail-tool').count()); checks.push('Stored Gemini tool responses and review-only branch');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/audits/${audit.id}`); await page.getByRole('tab', { name: '3D audit trail' }).click();
  await page.locator('.trail-flat').waitFor();
  await page.locator('.audit-trail').screenshot({ path: `${directory}/mobile.png` });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.getByRole('button', { name: '3D view', exact: true }).click(); await page.locator('.trail-canvas[data-ready="true"]').waitFor();
  await page.locator('.trail-stage').screenshot({ path: `${directory}/mobile-3d.png` });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const labels = await page.locator('.trail-node-label').evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).visibility === 'visible').map(node => { const { x, y, width, height } = node.getBoundingClientRect(); return { x, y, width, height }; }));
  assert.equal(labels.length, 7, 'All seven mobile stage markers should be visible');
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
    const a = labels[i], b = labels[j];
    assert.equal(a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y, false, 'Mobile stage markers must not overlap');
  }
  await page.locator('.trail-inspect-jump').click();
  assert.equal(await inspector.evaluate(node => node === document.activeElement), true, 'The mobile evidence shortcut must focus the inspector');
  checks.push('Responsive flat view and optional mobile 3D');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open();
  await page.locator('.trail-stage').screenshot({ path: `${directory}/laptop.png` });
  await canvas.evaluate(node => node.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.locator('.trail-fallback').waitFor();
  assert.equal(await page.locator('.trail-canvas canvas').count(), 0, 'Lost contexts must be released');
  assert.equal(await page.locator('.trail-flat-node').count(), 7);
  await page.locator('.trail-flat-node').filter({ hasText: 'Policy snapshot' }).click();
  assert.equal(await inspector.getByRole('heading', { name: 'Policy snapshot' }).count(), 1);
  await page.locator('.audit-trail').screenshot({ path: `${directory}/fallback.png` });
  await page.getByRole('button', { name: '3D view', exact: true }).click();
  await page.locator('.trail-canvas[data-ready="true"]').waitFor();
  assert.equal(await canvas.count(), 1, 'Retry must create only one new canvas');
  checks.push('On-demand idle rendering, reduced-motion use, context-loss fallback and renderer recreation');

  // Browser-only fixtures: no job creation, provider calls or production data mutation.
  let fixture = { ...detail, status: 'queued', name: 'Synthetic queued audit fixture', progress: 'Waiting for a worker', findings: undefined, normalization: undefined, counts: undefined, coverage: undefined, report: undefined, evaluated_at: undefined, completed_at: undefined, investigation: undefined, agent_checkpoint: undefined, error: undefined, failed_stage: undefined };
  await page.route(`**/api/audits/${audit.id}`, route => route.fulfill({ json: fixture }));
  await open();
  await rail.getByRole('button', { name: 'Inspect Configuration interpretation' }).click();
  assert.equal(await inspector.locator('.trail-state').innerText(), 'Queued');
  await page.locator('.audit-trail').screenshot({ path: `${directory}/queued-fixture.png` });
  fixture = { ...detail, status: 'failed', name: 'Synthetic failed investigation fixture', failed_stage: 'learn', error: 'Synthetic provider timeout', investigation: undefined, agent_checkpoint: undefined };
  await open();
  await rail.getByRole('button', { name: 'Inspect Gemini investigation' }).click();
  assert.equal(await inspector.locator('.trail-state').innerText(), 'Failed');
  assert.equal(await inspector.locator('.error-box').innerText(), 'Synthetic provider timeout');
  assert.match(await page.locator('.trail-node-label').filter({ hasText: 'Report' }).innerText(), /Artifact ready/);
  await page.locator('.audit-trail').screenshot({ path: `${directory}/failed-fixture.png` });
  await page.unroute(`**/api/audits/${audit.id}`);
  checks.push('Synthetic queued and failed-stage fixtures preserve earlier report evidence');

  const fallbackPage = await context.newPage();
  fallbackPage.on('pageerror', error => errors.push(error.message));
  await fallbackPage.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type.startsWith('webgl') ? null : original.call(this, type, ...args); };
  });
  await fallbackPage.goto(`${base}/audits/${audit.id}`);
  await fallbackPage.getByRole('tab', { name: '3D audit trail' }).click();
  await fallbackPage.locator('.trail-fallback').waitFor();
  assert.equal(await fallbackPage.locator('.trail-flat-node').count(), 7);
  await fallbackPage.close();
  checks.push('Unavailable WebGL automatically retains all seven stages in flat view');
  assert.equal(errors.length, 0, 'No browser exceptions'); assert.equal(violations.length, 0, 'No CSP violations');
  writeFileSync(`${directory}/checks.json`, JSON.stringify({ checks, errors, violations }, null, 2));
  console.log(JSON.stringify({ checks, errors, violations }));
} catch (error) {
  const pages = browser.contexts().flatMap(context => context.pages());
  await pages.at(-1)?.screenshot({ path: `${directory}/failure.png`, fullPage: true });
  console.error(JSON.stringify({ error: error.message, errors, violations })); process.exitCode = 1;
} finally { await browser.close(); }
