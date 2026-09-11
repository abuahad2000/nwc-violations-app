import {test,expect} from '@playwright/test';
test('map status cards filter points and sidebar without changing page totals',async({page})=>{
 await page.route('https://tile.openstreetmap.org/**',route=>route.fulfill({contentType:'image/png',path:'tests/fixtures/osm-test-tile.png'}));
 await page.goto('/login');await page.getByLabel('البريد الإلكتروني').fill('qa_admin');await page.getByLabel('كلمة المرور',{exact:true}).fill('admin');await page.getByRole('button',{name:'تسجيل الدخول',exact:true}).click();await expect(page).toHaveURL(/dashboard/);
 const map=page.getByRole('region',{name:'خريطة الخدمات والبلاغات'});await expect(map.getByRole('heading',{name:/التوزيع المكاني.*نقطة/})).toBeVisible();
 const response=await page.request.get('/api/map');const data=await response.json();const closed=data.points.features.filter((f:{properties:{is_closed:number}})=>f.properties.is_closed).length;
 await map.getByRole('button',{name:/^تمت المعالجة/}).click();await expect(map.getByRole('heading',{name:`التوزيع المكاني (${closed} نقطة)`,exact:true})).toBeVisible();
 const list=map.getByRole('complementary',{name:'قائمة البلاغات الظاهرة'});await expect(list.getByRole('button')).toHaveCount(closed);
 await map.getByRole('button',{name:/^تحت معالجة المقاول/}).click();const contractor=data.points.features.filter((f:{properties:{is_closed:number;source_status:string}})=>!f.properties.is_closed&&f.properties.source_status==='تحت معالجة المقاول').length;
 await expect(map.getByRole('heading',{name:`التوزيع المكاني (${contractor} نقطة)`,exact:true})).toBeVisible();
 await map.getByRole('tab',{name:'مياه',exact:true}).click();await expect(map.getByRole('heading',{name:'التوزيع المكاني (0 نقطة)',exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await map.screenshot({path:'test-results/map-services-mobile.png'});
});
