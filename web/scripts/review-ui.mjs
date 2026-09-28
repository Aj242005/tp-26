// Inspect the local UI with real authentication; credentials never leave memory.
import { chromium } from '@playwright/test';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const suffix = process.argv[2] || 'current';
const base = process.argv[3] || 'http://localhost:8185';
const env = Object.fromEntries(readFileSync('../.env', 'utf8').split(/\r?\n/)
  .filter(line => /^[A-Z_]+=/.test(line)).map(line => {
    const at = line.indexOf('=');
    return [line.slice(0, at), line.slice(at + 1).replace(/^['"]|['"]$/g, '')];
  }));
const directory = `../runtime/ui-${suffix}`;
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const errors = [];
const violations = [];
try {
  const context = await browser.newContext({ baseURL: base, viewport: { width: 1600, height: 1060 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  // Full page reloads discard the query cache. Pace automated reads within the
  // production 120/minute user quota instead of weakening application limits.
  let nextRead = 0;
  await page.route('**/api/**', async route => {
    if (route.request().method() === 'GET' && !new URL(route.request().url()).pathname.startsWith('/api/auth/')) {
      const wait = Math.max(0, nextRead - Date.now());
      nextRead = Math.max(nextRead, Date.now()) + 550;
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    }
    await route.continue();
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeFunction('reportViolation', directive => violations.push(directive));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', event => window.reportViolation(event.violatedDirective)));
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in to your workspace' }).waitFor();
  await page.screenshot({ path: `${directory}/login.png`, fullPage: true });
  await page.getByRole('link', { name: 'Sign in to your workspace' }).click();
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill(env.LOCAL_ADMIN_PASSWORD);
  await page.locator('#kc-login').click();
  await page.getByRole('navigation', { name: 'Main navigation' }).waitFor({ timeout: 45000 });
  const recent = await (await context.request.get('/api/records?kind=audit&page_size=100')).json();
  const audit = recent.items.find(row => row.synthetic && row.vendor === 'ios' && row.status === 'complete');
  const routes = [['overview', '/'], ['devices', '/devices'], ['audits', '/audits'], ['training', '/training'], ['policies', '/policies'], ['sources', '/sources'], ['settings', '/administration']];
  if (audit) routes.push(['evidence', `/audits/${audit.id}`]);
  const checks = [];
  for (const [name, route] of routes) {
    await page.goto(route);
    await page.locator('h1').waitFor();
    await page.waitForFunction(() => !document.querySelector('.loading'));
    await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true });
    if (name === 'overview' || name === 'training') await page.screenshot({ path: `${directory}/${name}-viewport.png` });
    checks.push({ route: name, viewport: 'desktop', overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
    if (name === 'evidence' && suffix !== 'before') {
      const source = await page.locator('.code-window .code-line').first().boundingBox();
      assert.ok(source && source.y < 1060, 'First source evidence should be visible in the desktop viewport');
      checks.push({ interaction: 'first source evidence visible in desktop viewport', passed: true });
      await page.screenshot({ path: `${directory}/evidence-viewport.png` });
    }
  }
  if (suffix !== 'before') {
    await page.goto('/');
    await page.getByRole('heading', { name: 'Workspace overview' }).waitFor();
    await page.locator('.control-tile').first().waitFor();
    const tile = page.locator('.control-tile').last();
    const controlName = await tile.getAttribute('aria-label');
    await tile.hover();
    assert.ok(controlName.startsWith(await page.locator('.control-preview-title .mono').innerText()));
    await tile.click(); await page.locator('.studio-heading h2').hover();
    const pinned = await page.locator('.control-preview-title h4').innerText();
    assert.equal(await tile.getAttribute('aria-pressed'), 'true');
    await page.locator('.control-preview-link').click();
    await page.locator('.finding-detail h2').waitFor();
    assert.equal(await page.locator('.finding-detail h2').innerText(), pinned, 'The overview must open the exact selected finding');
    await page.goto('/'); await page.locator('.control-tile').first().waitFor();
    await page.getByRole('button', { name: 'Copy audit ID' }).click();
    assert.equal(await page.locator('.copy-feedback').innerText(), 'Copied');
    assert.ok((await page.evaluate(() => navigator.clipboard.readText())).startsWith(await page.locator('.lens-subhead .mono').innerText()));
    const second = page.locator('.audit-option').nth(1);
    const secondID = await second.locator('.mono').innerText();
    await second.click();
    await page.waitForFunction(id => document.querySelector('.lens-subhead .mono')?.textContent === id, secondID);
    await page.locator('.studio-trail-link').click();
    await page.locator('.trail-canvas[data-ready="true"]').waitFor({ timeout: 30000 });
    assert.equal(await page.getByRole('tab', { name: '3D audit trail' }).getAttribute('aria-selected'), 'true');
    await page.goto('/'); await page.locator('.control-tile').first().waitFor();
    await page.getByRole('button', { name: 'Collapse navigation' }).click();
    await page.waitForSelector('.nav-compact'); await page.waitForTimeout(400);
    await page.screenshot({ path: `${directory}/focus-mode.png` });
    await page.reload(); await page.getByRole('button', { name: 'Expand navigation' }).waitFor();
    assert.equal(await page.locator('.sidebar').evaluate(node => node.getBoundingClientRect().width), 70);
    await page.getByRole('button', { name: 'Expand navigation' }).click(); await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Reduce interface motion' }).click();
    await page.reload(); await page.getByRole('button', { name: 'Enable interface motion' }).waitFor();
    assert.equal(await page.locator('html').getAttribute('data-motion'), 'off');
    await page.locator('.control-tile').first().waitFor();
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    await page.getByRole('button', { name: 'Enable interface motion' }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/audits'); await page.locator('h1').waitFor();
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0, 'OS reduced motion must disable nonessential animations');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/'); await page.locator('.control-tile').first().waitFor();
    checks.push({ interaction: 'control hover/pinning, exact finding link, audit switching, direct 3D, clipboard feedback, focus and motion persistence', passed: true });
    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await page.waitForTimeout(400);
    await page.reload();
    await page.getByRole('button', { name: 'Switch to dark theme' }).waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await page.getByRole('heading', { name: 'Workspace overview' }).waitFor();
    await page.locator('.control-tile').first().waitFor();
    await page.screenshot({ path: `${directory}/overview-light.png`, fullPage: true });
    if (audit) {
      await page.goto(`/audits/${audit.id}`);
      await page.locator('.finding-detail').waitFor();
      await page.waitForFunction(() => !document.querySelector('.loading'));
      await page.screenshot({ path: `${directory}/evidence-light.png`, fullPage: true });
    }
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await page.keyboard.press('Control+k');
    const search = page.getByRole('combobox', { name: 'Search destinations' });
    await search.fill('review');
    assert.equal(await page.getByRole('option').count(), 1);
    await page.screenshot({ path: `${directory}/command-menu.png` });
    await search.press('Enter');
    await page.waitForURL('**/training');
    await page.keyboard.press('Control+k');
    await search.fill('no-such-destination');
    assert.equal(await page.getByRole('option').count(), 0);
    await search.fill('');
    await search.press('ArrowDown');
    assert.equal(await page.getByRole('option', { selected: true }).innerText(), 'Devices\nUpload configurations and run audits');
    await search.press('Enter');
    await page.waitForURL('**/devices');
    const trigger = page.getByRole('button', { name: 'Search workspace navigation' });
    await trigger.click();
    await search.press('Escape');
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
    await page.getByRole('button', { name: 'Add configurations' }).click();
    await page.getByLabel('Configuration files').setInputFiles('../fixtures/ios-review.cfg');
    await page.getByRole('button', { name: 'Remove ios-review.cfg' }).waitFor();
    await page.screenshot({ path: `${directory}/upload-form.png`, fullPage: true });
    await page.getByRole('button', { name: 'Remove ios-review.cfg' }).click();
    assert.equal(await page.getByRole('button', { name: 'Upload configurations', exact: true }).isDisabled(), true);
    const transfer = await page.evaluateHandle(() => { const data = new DataTransfer(); data.items.add(new File(['hostname ui-check'], 'ui-check.cfg', { type: 'text/plain' })); return data; });
    await page.locator('.upload-drop').dispatchEvent('dragover', { dataTransfer: transfer });
    assert.match(await page.locator('.upload-drop').getAttribute('class'), /dragging/);
    await page.locator('.upload-drop').dispatchEvent('drop', { dataTransfer: transfer });
    await page.getByRole('button', { name: 'Remove ui-check.cfg' }).waitFor();
    await transfer.dispose();
    checks.push({ interaction: 'upload file chips, removal, drag feedback and drop selection without submitting', passed: true });
    await page.goto('/training');
    await page.getByRole('button', { name: 'New mapping' }).click();
    await page.screenshot({ path: `${directory}/mapping-form.png`, fullPage: true });
    checks.push({ interaction: 'theme persistence, navigation filtering, arrow selection, Enter, Escape and focus restoration', passed: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [name, route] of routes) {
    await page.goto(route);
    await page.locator('h1').waitFor();
    await page.waitForFunction(() => !document.querySelector('.loading'));
    await page.screenshot({ path: `${directory}/${name}-mobile.png`, fullPage: true });
    checks.push({ route: name, viewport: 'mobile', overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
  }
  if (suffix !== 'before') {
    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await page.getByRole('heading', { name: 'Workspace overview' }).waitFor();
      await page.locator('.control-tile').first().waitFor();
      checks.push({ route: 'overview', viewport: width, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
      await page.screenshot({ path: `${directory}/overview-${width}.png` });
    }
  }
  writeFileSync(`${directory}/checks.json`, JSON.stringify({ checks, errors, violations }, null, 2));
  console.log(JSON.stringify({ directory, screenshots: readdirSync(directory).filter(file => file.endsWith('.png')).length, checks, errors, violations }));
  assert.equal(errors.length, 0, 'Browser errors');
  assert.equal(violations.length, 0, 'Content Security Policy violations');
  if (suffix !== 'before') assert.equal(checks.some(check => check.overflow), false, 'Document should not scroll horizontally');
} catch (error) {
  const page = browser.contexts().flatMap(context => context.pages()).at(-1);
  if (page) await page.screenshot({ path: `${directory}/failure.png`, fullPage: true });
  console.error(JSON.stringify({ error: error.message, path: page ? new URL(page.url()).pathname : null, alerts: page ? await page.locator('.error-box').allTextContents() : [], errors, violations }));
  process.exitCode = 1;
} finally { await browser.close(); }
