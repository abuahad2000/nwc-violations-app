import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';
test('program report, email and export contain the same nonclosed records', async ({
  request,
  page,
}) => {
  await request.post('/api/auth/login', { data: { email: 'qa_admin', password: 'admin' } });
  const r = await request.get('/api/reports/programs');
  expect(r.status()).toBe(200);
  const data = await r.json();
  const m = data.managers.find((x: { name: string }) => x.name === 'م. مدير برنامج تجريبي');
  expect(m).toMatchObject({ total: 1, open: 1, closed: 0 });
  expect(m.pending.map((v: { id: string }) => v.id)).toEqual(['test-inside']);
  const exportResponse = await request.get(
    '/api/reports/export/excel?' + new URLSearchParams({ program_manager: m.key, open: '1' }),
  );
  expect(exportResponse.status()).toBe(200);
  const wb = XLSX.read(await exportResponse.body(), { type: 'buffer' });
  const exported = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  expect(exported).toHaveLength(1);
  expect(exported[0]).toMatchObject({ 'مدير البرنامج': m.name, 'رقم البلاغ': 'test-inside' });
  await page.goto('/login');
  await page.getByLabel('البريد الإلكتروني').fill('qa_admin');
  await page.getByLabel('كلمة المرور', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'لوحة المتابعة', exact: true })).toBeVisible();
  await page.goto('/programs');
  await expect(
    page.getByRole('heading', { name: 'تقارير مديري البرامج', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'تفاصيل البلاغات المعلقة (١)' })).toBeVisible();
  await page.getByRole('button', { name: 'صيغة البريد', exact: true }).click();
  await expect(page.getByLabel('نص البريد')).toContainText('test-inside');
  await expect(page.getByLabel('نص البريد')).not.toContainText('test-closed');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'test-results/programs-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const statusChart = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'المعلّق بحسب حالة المصدر', exact: true }) });
  expect((await statusChart.boundingBox())!.width).toBeGreaterThan(280);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/programs-mobile.png', fullPage: true });
});
test('unused user removal is authorized, audited and blocks active or historical accounts', async ({
  request,
}) => {
  await request.post('/api/auth/login', {
    data: { email: 'e2e_reader@example.test', password: 'Synthetic-Test-Only-2026' },
  });
  expect((await request.delete('/api/users', { data: { id: 'e2e_admin' } })).status()).toBe(403);
  await request.post('/api/auth/login', { data: { email: 'qa_admin', password: 'admin' } });
  expect((await request.delete('/api/users', { data: { id: 'e2e_alias' } })).status()).toBe(409);
  const email = `unused-${Date.now()}@example.test`;
  const created = await request.post('/api/auth/register', {
    data: { name: 'حساب غير مستخدم', email, password: 'Unused-Only-2026', role: 'READER' },
  });
  expect(created.status()).toBe(200);
  const id = (await created.json()).user.id;
  expect(
    (
      await request.delete('/api/users', {
        headers: { Origin: 'https://evil.example' },
        data: { id },
      })
    ).status(),
  ).toBe(403);
  expect((await request.delete('/api/users', { data: { id } })).status()).toBe(200);
  expect((await request.delete('/api/users', { data: { id } })).status()).toBe(404);
  expect(
    (
      await request.post('/api/auth/login', { data: { email, password: 'Unused-Only-2026' } })
    ).status(),
  ).toBe(401);
  await request.post('/api/auth/login', {
    data: { email: 'e2e_a@example.test', password: 'Synthetic-Test-Only-2026' },
  });
  expect((await request.get('/api/reports/programs')).status()).toBe(403);
});
