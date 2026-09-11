import {test,expect} from '@playwright/test';
test('infographic accounts for pending records and exports a complete drawing',async({page,request})=>{
 await request.post('/api/auth/login',{data:{email:'qa_admin',password:'admin'}});
 const data=await (await request.get('/api/reports/infographic')).json();
 expect(data.summary.pending+data.summary.closed).toBe(data.summary.total);
 expect(data.contractors.reduce((s:number,c:{pending:number})=>s+c.pending,0)+data.summary.unassigned).toBe(data.summary.pending);
 await page.goto('/login');await page.getByLabel('البريد الإلكتروني').fill('qa_admin');await page.getByLabel('كلمة المرور',{exact:true}).fill('admin');await page.getByRole('button',{name:'تسجيل الدخول',exact:true}).click();await expect(page).toHaveURL(/dashboard/);
 await page.goto('/infographic');await expect(page.getByRole('heading',{name:'أكثر المقاولين لديهم بلاغات معلقة',exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/infographic-desktop.png',fullPage:true});
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'تنزيل الإنفوجرافيك SVG'}).click();const download=await downloading;await download.saveAs('test-results/infographic.svg');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:'test-results/infographic-mobile.png',fullPage:true});
});
