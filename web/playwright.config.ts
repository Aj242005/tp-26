import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', timeout: 180_000, expect: { timeout: 15_000 },
  fullyParallel: false, workers: 1, retries: 0,
  reporter: [['list'], ['json', { outputFile: '../runtime/browser-results.json' }]],
  use: { baseURL: 'http://localhost:8185', viewport: { width: 1440, height: 1000 },
    trace: 'off', screenshot: 'only-on-failure' },
});
