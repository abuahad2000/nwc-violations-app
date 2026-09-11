import {test,expect} from '@playwright/test';
test('administrative edits persist, update reports, reject stale saves and unauthorized requests',async({request,page})=>{
 await request.post('/api/auth/login',{data:{email:'qa_admin',password:'admin'}});
 const initial=await(await request.get('/api/contractor-management')).json();const p=initial.projects[0];
 const payload={kind:'project',id:p.id,version:p.version,project_manager_name:p.project_manager_name||'',program_manager_name:p.program_manager_name||'',executive_director_name:p.executive_director_name||'',subprogram_name:p.subprogram_name||''};
 expect((await request.patch('/api/contractor-management',{headers:{Origin:'https://evil.example'},data:payload})).status()).toBe(403);
 let version=p.version;
 try {
  const changed=await request.patch('/api/contractor-management',{data:{...payload,executive_director_name:'تنفيذي اختبار التعديل'}});expect(changed.status()).toBe(200);version=(await changed.json()).record.version;
  expect((await request.patch('/api/contractor-management',{data:payload})).status()).toBe(409);
  const data=await(await request.get('/api/contractor-management')).json();expect(data.projects.find((r:{id:string})=>r.id===p.id).executive_director_name).toBe('تنفيذي اختبار التعديل');
  const report=await(await request.get('/api/reports/program-dashboard')).json();expect(report.executives.some((r:{name:string})=>r.name==='تنفيذي اختبار التعديل')).toBe(true);
 }finally {expect((await request.patch('/api/contractor-management',{data:{...payload,version}})).status()).toBe(200);}
 await page.goto('/login');await page.getByLabel('البريد الإلكتروني').fill('qa_admin');await page.getByLabel('كلمة المرور',{exact:true}).fill('admin');await page.getByRole('button',{name:'تسجيل الدخول',exact:true}).click();await expect(page).toHaveURL(/dashboard/);
 await page.goto('/contractor-management');await page.getByRole('combobox',{name:'اختيار المقاول',exact:true}).selectOption(p.contractor_id);await page.getByRole('combobox',{name:'اختيار المشروع',exact:true}).selectOption(p.id);await expect(page.getByRole('combobox',{name:'مدير المشروع',exact:true})).toHaveValue(p.project_manager_name||'');await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:'test-results/contractor-management-mobile.png',fullPage:true});
 await request.post('/api/auth/login',{data:{email:'e2e_reader@example.test',password:'Synthetic-Test-Only-2026'}});expect((await request.get('/api/contractor-management')).status()).toBe(403);expect((await request.patch('/api/contractor-management',{data:payload})).status()).toBe(403);
});
