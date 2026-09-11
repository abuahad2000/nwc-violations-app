import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import ExcelJS from 'exceljs';
const ids = ['test-assignment-open', 'test-assignment-closed'];
let fixture: DatabaseSync;
test.beforeAll(() => {
  const dir = path.resolve(process.env.NWC_DATA_DIR || '');
  if (!dir.endsWith('nwc-repair-e2e')) throw Error('Isolated fixture required');
  fixture = new DatabaseSync(path.join(dir, 'nwc_local.db'));
  fixture
    .prepare('INSERT OR IGNORE INTO contractors(id,name,is_approved,created_at) VALUES(?,?,1,?)')
    .run('cont_nwc_operations', 'إدارة الصيانة', new Date().toISOString());
  for (const [i, id] of ids.entries())
    fixture
      .prepare(
        "INSERT INTO violations(id,source_reference,reported_contractor_name,reported_contractor_id,classification,classification_reason,source_status,is_closed,created_at,updated_at) VALUES(?,?,?,'b','UNDER_REVIEW','test',?,?,?,?)",
      )
      .run(
        id,
        id,
        'مقاول المصدر التجريبي',
        i ? 'تمت المعالجة' : 'مفتوح',
        i,
        new Date().toISOString(),
        new Date().toISOString(),
      );
});
test.afterAll(() => {
  if (!fixture) return;
  for (const id of ids) {
    fixture.prepare('DELETE FROM violation_manager_overrides WHERE violation_id=?').run(id);
    fixture.prepare('DELETE FROM manual_responsibility WHERE violation_id=?').run(id);
    fixture.prepare('DELETE FROM tasks WHERE violation_id=?').run(id);
    fixture.prepare('DELETE FROM audit_events WHERE entity_id=?').run(id);
    fixture.prepare('DELETE FROM violations WHERE id=?').run(id);
  }
  fixture.close();
});
test('batch assignment preserves source and closure, is atomic, can move to project, and protects writes', async ({
  request,
  page,
}) => {
  await request.post('/api/auth/login', { data: { email: 'qa_admin', password: 'admin' } });
  const getRows = async () =>
    (
      await (
        await request.get('/api/assignments?scope=ALL&state=ALL&search=test-assignment')
      ).json()
    ).rows;
  const rows = await getRows();
  expect(rows).toHaveLength(2);
  const payload = {
    records: rows.map((r: { id: string; updated_at: string }) => ({
      id: r.id,
      updated_at: r.updated_at,
    })),
    destination: 'MAINTENANCE',
    reason: 'اختبار إسناد اصطناعي',
  };
  expect(
    (
      await request.post('/api/assignments', {
        headers: { Origin: 'https://evil.example' },
        data: payload,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post('/api/assignments', {
        data: {
          ...payload,
          records: [payload.records[0], { id: 'nonexistent-record', updated_at: 'stale' }],
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (await getRows()).every(
      (r: { current_action_owner_id: string | null }) => r.current_action_owner_id === null,
    ),
  ).toBe(true);
  expect((await request.post('/api/assignments', { data: payload })).status()).toBe(200);
  expect((await request.post('/api/assignments', { data: payload })).status()).toBe(400);
  for (const id of ids) {
    expect(
      fixture
        .prepare(
          'SELECT reported_contractor_id,reported_contractor_name,is_closed,current_action_owner_id FROM violations WHERE id=?',
        )
        .get(id),
    ).toMatchObject({
      reported_contractor_id: 'b',
      reported_contractor_name: 'مقاول المصدر التجريبي',
      is_closed: id.endsWith('closed') ? 1 : 0,
      current_action_owner_id: 'cont_nwc_operations',
    });
    expect(
      fixture
        .prepare("SELECT count(*) n FROM tasks WHERE violation_id=? AND status='OPEN'")
        .get(id)!.n,
    ).toBe(id.endsWith('closed') ? 0 : 1);
  }
  await page.goto('/login');
  await page.getByLabel('البريد الإلكتروني').fill('qa_admin');
  await page.getByLabel('كلمة المرور', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto('/assignments');
  await page.getByRole('combobox', { name: 'العرض', exact: true }).selectOption('ALL');
  await page.getByLabel('البحث برقم البلاغ أو الحي').fill('test-assignment-open');
  await page
    .getByRole('checkbox', { name: 'تحديد البلاغ test-assignment-open', exact: true })
    .check();
  await page.getByRole('combobox', { name: 'تصفية مشاريع المقاول', exact: true }).selectOption('a');
  await page.getByRole('combobox', { name: 'المشروع', exact: true }).selectOption('e2e-project');
  await page.getByLabel('سبب التحديد').fill('المشروع الصحيح وفق مراجعة الاختبار');
  await page.getByRole('button', { name: 'اعتماد الجهة للبلاغات المحددة' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'تم تحديد الجهة' })).toBeVisible();
  expect(
    fixture
      .prepare(
        'SELECT project_id,current_action_owner_id,reported_contractor_id FROM violations WHERE id=?',
      )
      .get(ids[0]),
  ).toMatchObject({
    project_id: 'e2e-project',
    current_action_owner_id: 'a',
    reported_contractor_id: 'b',
  });
  expect(
    fixture.prepare('SELECT owner_id FROM manual_responsibility WHERE violation_id=?').get(ids[0])!
      .owner_id,
  ).toBe('a');
  const manager='مدير بلاغ مستقل تجريبي';
  const otherBefore=fixture.prepare("SELECT updated_at FROM violations WHERE id='test-inside'").get();
  const stamp=fixture.prepare('SELECT updated_at FROM violations WHERE id=?').get(ids[0])!.updated_at;
  const editPayload={id:ids[0],updated_at:stamp,manager_name:manager,reason:'اختبار تغيير مدير بلاغ واحد'};
  expect((await request.patch('/api/assignments',{headers:{Origin:'https://evil.example'},data:editPayload})).status()).toBe(403);
  await page.getByRole('button',{name:'تعديل متابعة البلاغ test-assignment-open',exact:true}).click();
  await page.getByRole('combobox',{name:'مدير هذا البلاغ',exact:true}).fill(manager);
  await page.getByLabel('سبب تعديل المتابعة',{exact:true}).fill(editPayload.reason);
  await page.getByRole('button',{name:'حفظ تعديل البلاغ',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await request.patch('/api/assignments',{data:editPayload})).status()).toBe(409);
  expect(fixture.prepare("SELECT updated_at FROM violations WHERE id='test-inside'").get()).toEqual(otherBefore);
  const detail=await(await request.get('/api/violations/'+ids[0])).json();expect(detail.data.project_manager_name).toBe(manager);
  for(const endpoint of ['/api/dashboard/stats','/api/reports/program-dashboard','/api/reports/programs']){
    const response=await request.get(endpoint);expect(response.status()).toBe(200);expect(JSON.stringify(await response.json())).toContain(manager);
  }
  const excel=await request.get('/api/reports/export/excel?search=test-assignment-open');expect(excel.status()).toBe(200);
  const book=new ExcelJS.Workbook();await book.xlsx.load(Uint8Array.from(await excel.body()).buffer);expect(JSON.stringify(book.worksheets[0].getSheetValues())).toContain(manager);
  const latest=(await getRows()).find((r:{id:string})=>r.id===ids[0]);
  expect((await request.patch('/api/assignments',{data:{...editPayload,updated_at:latest.updated_at,manager_name:''}})).status()).toBe(200);
  expect(fixture.prepare('SELECT * FROM violation_manager_overrides WHERE violation_id=?').get(ids[0])).toBeUndefined();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/assignments-mobile.png', fullPage: true });
  await page.reload();
  await page.getByLabel('البحث برقم البلاغ أو الحي').fill('test-assignment-open');
  await page.getByRole('button',{name:'تعديل متابعة البلاغ test-assignment-open',exact:true}).click();
  await page.getByRole('combobox',{name:'نوع التعديل',exact:true}).selectOption('MAINTENANCE');
  await page.getByLabel('سبب تعديل المتابعة',{exact:true}).fill('تحويل البلاغ إلى الصيانة للاختبار');
  await page.screenshot({path:'test-results/manager-dialog-mobile.png'});
  await page.getByRole('button',{name:'حفظ تعديل البلاغ',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(fixture.prepare('SELECT current_action_owner_id,reported_contractor_id FROM violations WHERE id=?').get(ids[0])).toMatchObject({current_action_owner_id:'cont_nwc_operations',reported_contractor_id:'b'});
  await request.post('/api/auth/login', {
    data: { email: 'e2e_reader@example.test', password: 'Synthetic-Test-Only-2026' },
  });
  expect((await request.get('/api/assignments')).status()).toBe(403);
  expect((await request.post('/api/assignments', { data: payload })).status()).toBe(403);
  expect((await request.patch('/api/assignments',{data:editPayload})).status()).toBe(403);
});
