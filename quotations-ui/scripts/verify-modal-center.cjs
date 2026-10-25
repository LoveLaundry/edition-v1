/**
 * Assert that the "Manage laundries" dialog is centred on the *viewport*, not on
 * the panel that contains it.
 *
 *   node scripts/verify-modal-center.cjs
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
  email: null,
  mobile_number: null,
  permissions: null,
  laundries: [{ id: 'lovelaundry', name: 'Love Laundry', role: 'PLATFORM_ADMIN', status: 'ACTIVE' }],
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  await page.addInitScript(
    ([token, u]) => {
      localStorage.setItem('ll_token', token);
      localStorage.setItem('ll_user', JSON.stringify(u));
    },
    ['modal-probe', user],
  );

  // Only stub the remote API — never the Vite document request.
  const isApi = (url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1';
  await page.route(
    (url) => isApi(url) && url.pathname === '/users',
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([user]) }),
  );
  await page.route(
    (url) => isApi(url) && url.pathname.startsWith('/laundries'),
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0 }) }),
  );
  await page.route((url) => isApi(url) && url.pathname === '/auth/status', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }),
  );

  await page.route((url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' && url.pathname !== '/users' && !url.pathname.startsWith('/laundries'), (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.goto(BASE + '/users', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  const trigger = page.locator('button[title="Manage laundries"], button[aria-label="Manage laundries"]').first();
  if (await trigger.count()) {
    await trigger.click();
  } else {
    console.log(JSON.stringify({ url: page.url(), body: (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 300) }));
    throw new Error('manage trigger not found');
  }
  await page.waitForTimeout(900);

  const box = await page.locator('div.max-w-lg').first().boundingBox();
  if (!box) throw new Error('dialog not found');

  const centre = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  const viewportCentre = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };

  await page.screenshot({ path: 'ui-review/modal-centered.png' });

  console.log(
    JSON.stringify(
      {
        dialogCentre: centre,
        viewportCentre,
        offsetPx: { x: centre.x - viewportCentre.x, y: centre.y - viewportCentre.y },
        parent: await page.locator('div.max-w-lg').first().evaluate((el) => {
          let depth = 0;
          let node = el;
          while (node && node !== document.body) {
            depth += 1;
            node = node.parentElement;
          }
          return { ancestorsToBody: depth, directParentIsBody: el.parentElement === document.body };
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
