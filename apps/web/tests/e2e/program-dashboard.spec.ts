import { test, expect } from '@playwright/test';
test('program hierarchy reconciles counts and filters dashboard above map', async ({
  page,
  request,
}) => {
  await request.post('/api/auth/login', { data: { email: 'qa_admin', password: 'admin' } });
  const r = await request.get('/api/reports/program-dashboard');
  expect(r.status()).toBe(200);
  const d = await r.json();
  const stats = await (await request.get('/api/dashboard/stats')).json();
  expect(d.assigned.total + d.unassigned.total).toBe(stats.data.total);
  expect(d.assigned.pending + d.unassigned.pending).toBe(stats.data.open);
  for (const p of d.programs) {
    expect(p.contractor).toBeLessThanOrEqual(p.pending);
    expect(p.managers.reduce((s: number, m: { total: number }) => s + m.total, 0)).toBe(p.total);
  }
  await page.goto('/login');
  await page.getByLabel('البريد الإلكتروني').fill('qa_admin');
  await page.getByLabel('كلمة المرور', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  const chart = page.getByRole('region', { name: 'تقرير مدراء البرامج والبلاغات' });
  await expect(chart).toBeVisible();
  await chart.locator('summary').first().click();
  await expect(chart.getByText('مدير المشروع:', { exact: false }).first()).toBeVisible();
  await chart.getByRole('button', { name: 'عرض بلاغات البرنامج على الخريطة' }).first().click();
  await expect(page).toHaveURL(/program_manager=/);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(chart).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await chart.screenshot({ path: 'test-results/program-dashboard-mobile.png' });
});
