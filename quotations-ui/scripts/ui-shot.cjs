/**
 * Screenshot the running dev server using the Chrome already installed on this
 * machine (the Playwright bundle's own browser download is blocked here).
 *
 *   node scripts/ui-shot.cjs [path=/login] [name=login]
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
const target = process.argv[2] || '/login';
const name = process.argv[3] || 'login';
const outDir = path.join(__dirname, '..', 'ui-review');

(async () => {
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const results = [];

  for (const [label, viewport] of [
    ['1440', { width: 1440, height: 900 }],
    ['390', { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(String(e)));

    const response = await page.goto(BASE + target, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    // Give fonts and first-paint animations a beat to settle.
    await page.waitForTimeout(1200);

    const file = path.join(outDir, `${name}-${label}.png`);
    await page.screenshot({ path: file, fullPage: true });

    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400);
    results.push({
      viewport: label,
      status: response ? response.status() : null,
      file,
      text,
      errors: consoleErrors.slice(0, 5),
    });

    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch((err) => {
  console.error('SHOT_FAILED:', err.message);
  process.exit(1);
});
