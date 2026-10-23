const crypto = require('node:crypto');
const { test, expect } = require('@playwright/test');
const signature = require('cookie-signature');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ quiet: true });

let pool;
let sessionId;

test.beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const result = await pool.query(
    `SELECT id, email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    ['ngtruongmetin@gmail.com'],
  );
  if (!result.rows[0]) throw new Error('Admin test user does not exist.');
  const user = result.rows[0];
  await pool.query(
    `INSERT INTO admin_permissions (user_id, role) VALUES ($1, 'super_admin')
     ON CONFLICT (user_id, role) DO NOTHING`,
    [user.id],
  );
  sessionId = `playwright-${crypto.randomBytes(12).toString('hex')}`;
  await pool.query(
    `INSERT INTO user_sessions (sid, sess, expire) VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
    [
      sessionId,
      {
        cookie: {
          originalMaxAge: 600_000,
          expires: new Date(Date.now() + 600_000).toISOString(),
          secure: false,
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
        },
        user: {
          id: user.id,
          email: user.email,
          displayName: null,
          avatarUrl: null,
          roles: ['super_admin'],
        },
        csrfToken: crypto.randomBytes(24).toString('base64url'),
      },
    ],
  );
});

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: process.env.SESSION_COOKIE_NAME || 'gala.sid',
      value: `s:${signature.sign(sessionId, process.env.SESSION_SECRET)}`,
      url: 'http://localhost:1411',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
});

test.afterAll(async () => {
  if (sessionId) await pool.query('DELETE FROM user_sessions WHERE sid = $1', [sessionId]);
  await pool?.end();
});

test('admin dashboard exposes operational navigation and real metrics', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Tổng quan vận hành' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Đơn hàng' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Vé', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nhân sự' })).toBeVisible();
  await expect(page.getByText('Doanh thu ròng').first()).toBeVisible();
  await page.goto('/admin/don-hang');
  await expect(page.getByRole('heading', { name: 'Đơn hàng' })).toBeVisible();
  await page.goto('/admin/ve');
  await expect(page.getByRole('heading', { name: 'Vé đã phát hành' })).toBeVisible();
  await page.goto('/admin/nhan-su');
  await expect(page.getByRole('heading', { name: 'Nhân sự' })).toBeVisible();
});

test('buyer portal and ticket scanning tool render on mobile without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tai-khoan');
  await expect(page.getByRole('heading', { name: 'Vé của tôi' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.goto('/check-in');
  await expect(page.getByRole('heading', { name: 'Soát vé' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mở camera sau' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Soát vé' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Quản trị' }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('landing exposes organizers, school links and reduced-motion fallback', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(
    page.getByRole('img', { name: 'Logo Trường THPT Nguyễn Trãi - Bình Dương' }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Logo Đoàn trường THPT Nguyễn Trãi - Bình Dương' }).first(),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Google Maps/ }).first()).toHaveAttribute(
    'href',
    'https://maps.app.goo.gl/Crt2VzARMN2MKPSY6',
  );
  await expect(page.getByRole('link', { name: /fanpage Trường/ })).toHaveAttribute(
    'href',
    'https://www.facebook.com/profile.php?id=61588679217298',
  );
  await expect(page.locator('.hero-stage-image')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.ticker-track')).toHaveCSS('animation-name', 'none');
  await expect(page.getByText('Mỗi đơn', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Giữ chỗ', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Chung một sân khấu, chung một mục tiêu')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('admin can manage a landing partner', async ({ page }) => {
  const authResponse = await page.request.get('/api/auth/me');
  const auth = (await authResponse.json()).data;
  const headers = { 'X-CSRF-Token': auth.csrfToken };
  const createResponse = await page.request.post('/api/admin/partners', {
    headers,
    multipart: {
      name: 'Đơn vị đồng hành thử nghiệm',
      websiteUrl: 'https://gala.thptnguyentraibinhduong.edu.vn',
      sortOrder: '999',
      active: 'true',
      logo: {
        name: 'logo.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
          'base64',
        ),
      },
    },
  });
  expect(createResponse.ok()).toBe(true);
  const partner = (await createResponse.json()).data;
  expect(partner.logoUrl).toBe(`/api/event-settings/partners/${partner.id}/logo`);
  const logoResponse = await page.request.get(partner.logoUrl);
  expect(logoResponse.headers()['content-type']).toContain('image/png');

  try {
    await page.goto('/');
    await expect(page.getByText('Đơn vị đồng hành thử nghiệm', { exact: true })).toBeVisible();
    await page.goto('/admin/cau-hinh');
    await expect(page.getByRole('heading', { name: 'Đơn vị đồng hành' })).toBeVisible();
    await expect(page.getByText('Đơn vị đồng hành thử nghiệm', { exact: true })).toBeVisible();
  } finally {
    const deleteResponse = await page.request.delete(`/api/admin/partners/${partner.id}`, {
      headers,
    });
    expect(deleteResponse.ok()).toBe(true);
  }
});

test('a short partner list stays centered and does not repeat as a marquee', async ({ page }) => {
  await page.route('**/api/event-settings', async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    payload.data.partners = [1, 2, 3].map((number) => ({
      id: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
      name: `Đơn vị mẫu ${number}`,
      logoUrl: number % 2 ? '/images/logotruong.png' : '/images/logodoan.png',
      websiteUrl: null,
      sortOrder: number,
      active: true,
    }));
    await route.fulfill({ response, json: payload });
  });
  await page.goto('/');
  await expect(page.locator('.partner-static')).toBeVisible();
  await expect(page.locator('.partner-static img')).toHaveCount(3);
  await expect(page.locator('.partner-marquee')).toHaveCount(0);
});

const responsiveViewports = [
  { name: 'small-phone', width: 320, height: 568 },
  { name: 'android-phone', width: 360, height: 800 },
  { name: 'large-phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const viewport of responsiveViewports) {
  test(`core portals fit the ${viewport.name} viewport`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const path of [
      '/',
      '/tai-khoan',
      '/check-in',
      '/admin',
      '/admin/don-hang',
      '/admin/ve',
      '/admin/nhan-su',
      '/admin/cau-hinh',
    ]) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      const layout = await page.evaluate(() => ({
        fits: document.documentElement.scrollWidth <= window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        offenders: [...document.querySelectorAll('body *')]
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.right > window.innerWidth + 0.5 || rect.left < -0.5;
          })
          .slice(0, 5)
          .map((element) => ({
            tag: element.tagName,
            className: element.className,
            width: Math.round(element.getBoundingClientRect().width),
          })),
      }));
      expect(
        layout.fits,
        `${path} must not create page-level horizontal overflow at ${viewport.width}px: ${JSON.stringify(layout)}`,
      ).toBe(true);
    }
  });
}

test('mobile admin navigation and record cards replace desktop navigation patterns', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/admin/don-hang');

  const mobileNav = page.getByRole('navigation', {
    name: 'Điều hướng quản trị trên điện thoại',
  });
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole('link', { name: 'Đơn hàng' })).toHaveClass(/text-coral/);
  await expect(page.locator('table')).toBeHidden();

  await mobileNav.getByRole('button', { name: 'Thêm' }).click();
  await expect(page.getByRole('dialog', { name: 'Thêm điều hướng' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nhân sự' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cấu hình' })).toBeVisible();

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/admin/don-hang');
  await expect(mobileNav).toBeHidden();
  await expect(page.locator('table')).toBeVisible();
});
