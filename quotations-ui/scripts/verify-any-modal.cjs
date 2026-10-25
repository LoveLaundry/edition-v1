/**
 * Geometry check for the platform registry dialog (a different component from
 * the users page, exercising the codemod rather than the hand-wrapped modal).
 *
 *   node scripts/verify-any-modal.cjs
 */
const { chromium } = require('playwright');

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
const VIEWPORT = { width: 1440, height: 900 };

const user = {
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
  const page = await browser.newPage({ viewport: VIEWPORT });

  await page.addInitScript(
    ([token, u]) => {
      localStorage.setItem('ll_token', token);
      localStorage.setItem('ll_user', JSON.stringify(u));
    },
    ['modal-probe-2', user],
  );

  const isApi = (url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1';
  await page.route((u) => isApi(u) && u.pathname.startsWith('/laundries'), (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], total: 0 }),
    }),
  );
  await page.route((u) => isApi(u), (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );

  await page.goto(BASE + '/laundries', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  await page.getByRole('button', { name: /register|new laundry|add laundry/i }).first().click();
  await page.waitForTimeout(800);

  const dialog = page.locator('form').first();
  const box = await dialog.boundingBox();
  if (!box) throw new Error('dialog not found');

  const centre = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  const viewportCentre = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };

  await page.screenshot({ path: 'ui-review/modal-laundries.png' });

  console.log(
    JSON.stringify(
      {
        dialogCentre: centre,
        viewportCentre,
        offsetPx: { x: centre.x - viewportCentre.x, y: centre.y - viewportCentre.y },
        portalled: await dialog.evaluate((el) => {
          let node = el;
          while (node && node !== document.body) node = node.parentElement;
          return node === document.body;
        }),
      },
      null,
      2,
    ),
  );

  await browser.close();
})().catch((e) => {
  console.error('VERIFY_FAILED:', e.message);
  process.exit(1);
});
