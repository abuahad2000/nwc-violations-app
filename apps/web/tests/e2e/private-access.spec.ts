import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
test.describe('private link gate', () => {
  test.skip(!process.env.NWC_GATE_TEST_DB_PATH, 'Run separately against the isolated gate fixture');
  const token = 'g'.repeat(43);
  test.beforeAll(() => {
    const path = process.env.NWC_GATE_TEST_DB_PATH!;
    if (!path.includes('nwc-repair-e2e')) throw Error('Isolated fixture required');
    const db = new DatabaseSync(path);
    db.prepare('INSERT OR REPLACE INTO system_settings VALUES (?,?)').run(
      'private_access_token_sha256',
      createHash('sha256').update(token).digest('hex'),
    );
    db.close();
  });
  test.afterAll(() => {
    const db = new DatabaseSync(process.env.NWC_GATE_TEST_DB_PATH!);
    db.prepare('DELETE FROM system_settings WHERE key=?').run('private_access_token_sha256');
    db.close();
  });
  test('private link unlocks login only, APIs still require a valid account', async ({
    page,
    request,
  }) => {
    for (const path of ['/login', '/dashboard', '/programs', '/infographic']) {
      const r = await request.get(path, { maxRedirects: 0 });
      expect(r.status()).toBe(307);
      expect(r.headers().location).toBe('/entry');
    }
    expect(
      (
        await request.post('/api/auth/login', { data: { email: 'qa_admin', password: 'admin' } })
      ).status(),
    ).toBe(404);
    expect((await request.get('/api/reports/infographic')).status()).toBe(401);
    expect((await request.post('/api/access', { data: { token: 'x'.repeat(43) } })).status()).toBe(
      404,
    );
    expect(
      (
        await request.post('/api/access', {
          headers: { Origin: 'https://evil.example' },
          data: { token },
        })
      ).status(),
    ).toBe(403);
    const entry = await request.get('/entry');
    expect(await entry.text()).not.toContain('التعديات');
    expect(entry.headers()['x-robots-tag']).toContain('noindex');
    const valid = await request.post('/api/access', { data: { token } });
    expect(valid.status()).toBe(200);
    expect(valid.headers()['set-cookie']).toContain('HttpOnly');
    expect((await request.get('/api/reports/infographic')).status()).toBe(401);
    await page.goto('/entry#' + token);
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('البريد الإلكتروني').fill('qa_admin');
    await page.getByLabel('كلمة المرور', { exact: true }).fill('admin');
    await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'لوحة المتابعة', exact: true })).toBeVisible();
    await page.goto('/infographic');
    await expect(
      page.getByRole('heading', { name: 'إنفوجرافيك المشاريع والتعديات', exact: true }),
    ).toBeVisible();
  });
});
