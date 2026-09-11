import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';
const credentials = (id: string) => ({
  email: `e2e_${id}@example.test`,
  password: 'Synthetic-Test-Only-2026',
});
test('anonymous APIs reject data and public admin registration', async ({ request }) => {
  for (const path of [
    '/api/violations',
    '/api/violations/test-inside',
    '/api/contractors',
    '/api/contractors/a',
    '/api/dashboard/stats',
    '/api/imports',
    '/api/projects',
    '/api/map',
    '/api/reports/export/excel',
    '/api/users',
  ])
    expect((await request.get(path)).status(), path).toBe(401);
  expect(
    (
      await request.post('/api/auth/register', {
        data: {
          name: 'test',
          email: 'blocked@example.test',
          password: 'Synthetic-Test-Only-2026',
          role: 'SUPER_ADMIN',
        },
      })
    ).status(),
  ).toBe(401);
  expect((await request.post('/api/imports/preview')).status()).toBe(401);
});
test('contractor scope is identical across list, stats, details, map and export', async ({
  request,
}) => {
  expect((await request.post('/api/auth/login', { data: credentials('a') })).ok()).toBeTruthy();
  const list = await (await request.get('/api/violations')).json();
  expect(list.data.map((r: { id: string }) => r.id).sort()).toEqual(['test-closed', 'test-inside']);
  expect((await request.get('/api/violations/test-outside')).status()).toBe(404);
  expect((await (await request.get('/api/dashboard/stats')).json()).data.total).toBe(2);
  expect((await (await request.get('/api/map')).json()).points.features).toHaveLength(2);
  const exportResponse = await request.get('/api/reports/export/excel');
  expect(exportResponse.ok()).toBeTruthy();
  const wb = XLSX.read(await exportResponse.body(), { type: 'buffer' });
  expect(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])).toHaveLength(2);
  expect((await request.post('/api/imports', { data: { action: 'preview-local' } })).status()).toBe(
    403,
  );
});
test('card filter, reset, accessible details and mobile width', async ({ page }) => {
  // Do not load public OSM tiles in repeated automated tests.
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({ contentType: 'image/png', path: 'tests/fixtures/osm-test-tile.png' }),
  );
  await page.goto('/login');
  await page.getByLabel('البريد الإلكتروني').fill(credentials('reader').email);
  await page.getByLabel('كلمة المرور', { exact: true }).fill(credentials('reader').password);
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'لوحة المتابعة', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'داخل المشاريع' }).click();
  await expect(page.getByRole('button', { name: 'test-inside', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'test-outside', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'test-inside', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'مسح', exact: true }).click();
  await expect(page.getByRole('button', { name: 'test-outside', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /التوزيع المكاني.*نقطة/ })).toBeVisible();
  await page.locator('[data-map-ready]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-map-ready]')).toHaveAttribute('data-map-ready', 'true');
  await page.getByLabel('نوع المشروع على الخريطة').selectOption('WATER');
  await expect(page.getByRole('heading', { name: /التوزيع المكاني.*0 نقطة/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'test-outside', exact: true })).toBeVisible();
  await page.getByLabel('نوع المشروع على الخريطة').selectOption('ALL');
  await expect(page.getByRole('heading', { name: /التوزيع المكاني.*4 نقطة/ })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'متابعة مديري المشاريع', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'عرض تعديات م. مدير تجريبي', exact: true }).click();
  await expect(page.getByRole('button', { name: 'test-outside', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'إزالة تصفية الشارت', exact: true }).click();
  await expect(page.getByRole('button', { name: 'test-outside', exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'القائمة', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'القائمة', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
});

test('short username login and manager charts share listing, map and export filters', async ({
  request,
}) => {
  expect(
    (
      await request.post('/api/auth/login', { data: { email: 'qa_admin', password: 'admin' } })
    ).ok(),
  ).toBeTruthy();
  const s = await (await request.get('/api/dashboard/stats')).json();
  expect(
    s.data.managers.reduce((sum: number, m: { total: number }) => sum + m.total, 0) +
      s.data.unassigned_manager,
  ).toBe(s.data.total);
  expect(s.data.statuses.reduce((sum: number, r: { count: number }) => sum + r.count, 0)).toBe(
    s.data.total,
  );
  const manager = s.data.managers.find((m: { name: string }) => m.name === 'م. مدير تجريبي');
  expect(manager).toMatchObject({ total: 1, contractor: 1, processing: 1 });
  const q = new URLSearchParams({
    manager: manager.key,
    source_status: 'تحت معالجة المقاول',
  }).toString();
  const list = await (await request.get('/api/violations?' + q)).json();
  expect(list.data.map((v: { id: string }) => v.id)).toEqual(['test-inside']);
  expect((await (await request.get('/api/dashboard/stats?' + q)).json()).data.total).toBe(1);
  expect((await (await request.get('/api/map?' + q)).json()).points.features).toHaveLength(1);
  const sheet = XLSX.read(await (await request.get('/api/reports/export/excel?' + q)).body(), {
    type: 'buffer',
  });
  expect(XLSX.utils.sheet_to_json(sheet.Sheets[sheet.SheetNames[0]])).toHaveLength(1);
});
test('reader cannot create privileged accounts or mutate task assignments', async ({ request }) => {
  await request.post('/api/auth/login', { data: credentials('reader') });
  expect((await request.post('/api/auth/register', { data: {} })).status()).toBe(403);
  expect((await request.post('/api/tasks', { data: {} })).status()).toBe(403);
  expect((await request.get('/api/violations?page=NaN')).status()).toBe(400);
});
test('admin preview and commit persists exactly once', async ({ request }) => {
  await request.post('/api/auth/login', { data: credentials('admin') });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      { 'رقم بلاغ التعدي': 'e2e-import-0001', 'حالة البلاغ': 'تمت المعالجة' },
    ]),
    'source',
  );
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const preview = await request.post('/api/imports/preview', {
    multipart: {
      file: {
        name: 'synthetic.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer,
      },
    },
  });
  expect(preview.ok()).toBeTruthy();
  const p = await preview.json();
  const commit = await request.post('/api/imports', {
    data: { action: 'commit', preview_id: p.preview_id },
  });
  expect(commit.ok()).toBeTruthy();
  const result = await (await request.get('/api/violations?search=e2e-import-0001')).json();
  expect(result.pagination.total).toBe(1);
  expect(result.data[0].is_closed).toBe(1);
});

test('browser origin checks and initial password rotation', async ({ request }) => {
  const login = await request.post('/api/auth/login', {
    headers: { Origin: 'http://evil.example' },
    data: credentials('admin'),
  });
  expect(login.status()).toBe(403);
  await request.post('/api/auth/login', { data: credentials('admin') });
  const email = `new-${Date.now()}@example.test`;
  const created = await request.post('/api/auth/register', {
    data: {
      name: 'حساب اختبار جديد',
      email,
      password: 'Initial-Synthetic-Password',
      role: 'READER',
    },
  });
  expect(created.ok()).toBeTruthy();
  await request.post('/api/auth/logout');
  await request.post('/api/auth/login', {
    data: { email, password: 'Initial-Synthetic-Password' },
  });
  expect((await request.get('/api/violations')).status()).toBe(403);
  expect(
    (
      await request.post('/api/auth/password', {
        data: { current: 'Initial-Synthetic-Password', password: 'Changed-Synthetic-Password' },
      })
    ).ok(),
  ).toBeTruthy();
  expect((await request.get('/api/violations')).status()).toBe(401);
  await request.post('/api/auth/login', {
    data: { email, password: 'Changed-Synthetic-Password' },
  });
  expect((await request.get('/api/violations')).ok()).toBeTruthy();
});
