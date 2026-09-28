// Records real persisted workflows using synthetic evidence. Authentication is outside the recording.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const env = Object.fromEntries(readFileSync('../.env', 'utf8').split(/\r?\n/)
  .filter(line => /^[A-Z_]+=/.test(line)).map(line => {
    const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1).replace(/^['"]|['"]$/g, '')];
  }));
const browser = await chromium.launch();
const origin = 'http://localhost:8185';
mkdirSync('../runtime/demo-recording', { recursive: true });
mkdirSync('../docs/deliverables', { recursive: true });
try {
  const auth = await browser.newContext({ baseURL: origin });
  const login = await auth.newPage();
  await login.goto('/');
  await login.getByRole('link', { name: 'Sign in to your workspace' }).click();
  await login.locator('#username').fill('admin');
  await login.locator('#password').fill(env.LOCAL_ADMIN_PASSWORD);
  await login.locator('#kc-login').click();
  await login.getByRole('navigation').waitFor({ timeout: 45000 });
  const me = await (await auth.request.get('/api/me')).json();
  async function records(kind) {
    const rows = [];
    for (let offset = 0; offset < 1000; offset += 100) {
      const response = await auth.request.get(`/api/records?kind=${kind}&page_size=100&offset=${offset}`);
      assert.equal(response.status(), 200);
      const value = await response.json(); rows.push(...value.items);
      if (offset + 100 >= value.total) break;
    }
    return rows;
  }
  const devices = await records('device');
  const device = devices.find(row => row.filename === 'ios-review.cfg' && row.synthetic && !row.pending_delete);
  assert.ok(device, 'Load the synthetic IOS example first');
  const response = await auth.request.post('/api/audits', { data: { device_id: device.id },
    headers: { 'X-CSRF-Token': me.csrf, 'Idempotency-Key': crypto.randomUUID() } });
  assert.equal(response.status(), 202);
  const id = (await response.json()).id;
  let audit;
  for (let i = 0; i < 30; i++) {
    audit = await (await auth.request.get('/api/audits/' + id)).json();
    if (audit.status === 'complete' && audit.report) break;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  assert.equal(audit.status, 'complete');
  const investigation = (await records('audit')).find(row => row.vendor === 'unknown' && row.status === 'waiting_review');
  assert.ok(investigation, 'Run a synthetic Gemini investigation first');
  const pdf = await auth.request.get(`/api/audits/${id}/export/pdf`);
  assert.equal(pdf.status(), 200);
  const pdfBytes = await pdf.body();
  assert.equal(pdfBytes.subarray(0, 5).toString(), '%PDF-');
  writeFileSync('../docs/deliverables/example-device-report.pdf', pdfBytes);
  const state = await auth.storageState(); // Kept only in memory.
  await auth.close();
  const context = await browser.newContext({ baseURL: origin, storageState: state,
    viewport: { width: 1440, height: 1000 }, recordVideo: { dir: '../runtime/demo-recording', size: { width: 1440, height: 1000 } } });
  const page = await context.newPage();
  const scenes = [];
  const began = Date.now();
  async function caption(text, seconds = 10) {
    scenes.push({ second: Math.round((Date.now() - began) / 1000), text });
    await page.evaluate(text => {
      document.querySelector('#demo-caption')?.remove();
      const box = document.createElement('div'); box.id = 'demo-caption'; box.textContent = text;
      Object.assign(box.style, { position: 'fixed', left: '248px', right: '24px', bottom: '14px', zIndex: '9999',
        background: '#17253d', color: 'white', padding: '16px 20px', borderRadius: '8px', font: '18px/1.45 system-ui',
        boxShadow: '0 4px 24px #0003', pointerEvents: 'none' });
      document.body.append(box);
    }, text);
    await page.waitForTimeout(seconds * 1000);
  }
  await page.goto('/'); await page.getByRole('heading', { level: 1 }).waitFor();
  await caption('SIH26155: a real local audit workspace. All evidence in this recording is synthetic.', 9);
  await page.goto('/devices'); await page.getByRole('table').waitFor();
  await caption('Preserve configuration snapshots, declare their scope, then select a policy for evaluation.', 10);
  await page.goto('/audits/' + id); await page.getByRole('tab', { name: 'Findings & evidence' }).waitFor();
  await caption('Findings separate failures from missing evidence. Coverage is visible beside the result.', 11);
  await page.getByRole('button', { name: 'Fail', exact: true }).click();
  await page.locator('.finding-row').first().click();
  await caption('Each finding exposes observed values, exact source evidence and a reviewable remediation proposal.', 12);
  await page.getByRole('tab', { name: 'Configuration', exact: true }).click();
  await caption('The source viewer preserves line context. Hosted inference receives bounded, redacted excerpts.', 10);
  await page.goto('/audits/' + investigation.id);
  await page.getByRole('tab', { name: 'Investigation', exact: true }).click();
  await page.getByRole('heading', { name: 'Investigation summary' }).waitFor();
  await caption('This persisted investigation used the configured Gemini model to investigate unfamiliar syntax.', 12);
  await page.goto('/training'); await page.getByRole('heading', { level: 1 }).waitFor();
  await caption('Mapping semantics and test cases stay reviewable. AI output cannot activate itself.', 11);
  await page.goto('/audits/' + id); await page.getByRole('link', { name: 'Device PDF' }).waitFor();
  await caption('A per-device PDF, JSON and CSV come from the stored audit. No commands are applied to live equipment.', 11);
  const video = page.video();
  await context.close();
  await video.saveAs('../docs/deliverables/demo.webm');
  const duration = Math.round((Date.now() - began) / 1000);
  writeFileSync('../runtime/demo-result.json', JSON.stringify({ duration_seconds: duration, scenes,
    synthetic: true, authentication_recorded: false, real_pdf_verified: true }, null, 2));
  assert.ok(duration <= 120, 'Official demo limit is two minutes');
  console.log(JSON.stringify({ video: 'docs/deliverables/demo.webm', duration_seconds: duration, scenes: scenes.length }));
} finally {
  await browser.close();
}
