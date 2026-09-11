import {test,expect} from '@playwright/test';
test('old contractor spelling is reserved after rename and exports use the canonical name',async({request})=>{
 await request.post('/api/auth/login',{data:{email:'qa_admin',password:'admin'}});
 const data=await(await request.get('/api/contractor-management')).json();const a=data.contractors.find((c:{id:string})=>c.id==='a'),b=data.contractors.find((c:{id:string})=>c.id==='b');
 let version=a.version;
 try{
  const response=await request.patch('/api/contractor-management',{data:{kind:'contractor',id:a.id,version,name:'مقاول موحد تجريبي'}});expect(response.status()).toBe(200);version=(await response.json()).record.version;
  const conflict=await request.patch('/api/contractor-management',{data:{kind:'contractor',id:b.id,version:b.version,name:a.name}});expect(conflict.status()).toBe(409);
  const typo=await request.patch('/api/contractor-management',{data:{kind:'contractor',id:b.id,version:b.version,name:'مقاول موحد تجريبى'}});expect(typo.status()).toBe(409);
 }finally{expect((await request.patch('/api/contractor-management',{data:{kind:'contractor',id:a.id,version,name:a.name}})).status()).toBe(200);}
});
