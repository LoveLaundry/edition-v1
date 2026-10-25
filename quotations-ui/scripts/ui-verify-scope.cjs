/**
 * Verify that a platform-only session never reaches a tenant screen or fires a
 * tenant API call.
 *
 *   node scripts/ui-verify-scope.cjs
 */
const { chromium } = require('playwright');

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';

const platformUser = {
  id: '6ad1e4fca22df38ef3268a2f',
  auth_id: 'DulshanSiriwardhana',
  user_name: 'Company Manager',
  role_id: 'PLATFORM_ADMIN',
  status: 'active',
  platform_admin: true,
  laundries: [{ id: 'lovelaundry', name: 'Love Laundry', role: 'PLATFORM_ADMIN', status: 'ACTIVE' }],
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const tenantCalls = [];
  page.on('request', (req) => {
    const url = req.url();
    if (/quotation|bill_service|laundry-management|worker-service/i.test(url)) {
      tenantCalls.push(`${req.method()} ${url}`);
    }
  });

  await page.addInitScript(
    ([token, user]) => {
      localStorage.setItem('ll_token', token);
      localStorage.setItem('ll_user', JSON.stringify(user));
    },
    ['scope-probe-token', platformUser],
  );

  await page.goto(BASE + '/quotations', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);

  const result = {
    requested: '/quotations',
    landedOn: new URL(page.url()).pathname,
    tenantApiCalls: tenantCalls,
    heading: (await page.locator('h1').first().innerText().catch(() => '')).trim(),
  };

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch((e) => {
  console.error('VERIFY_FAILED:', e.message);
  process.exit(1);
});
