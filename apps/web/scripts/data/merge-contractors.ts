import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {db,postgresPool} from '../../src/lib/db/async';
import {contractorNameKey} from '../../src/lib/domain/contractor-name';
type Merge={source:string;target:string;sourceName:string;targetName:string;canonicalName?:string;reason:string};
async function main(){
 const plan=JSON.parse(readFileSync(process.argv[2],'utf8')) as Merge[];
 if(!plan.length||new Set(plan.map(p=>p.source)).size!==plan.length||plan.some(p=>p.source===p.target||plan.some(q=>q.source===p.target)))throw Error('Plan must have distinct sources and final targets without chains');
 try{
  const inventory=await db.prepare('SELECT * FROM contractors').all();
  for(const p of plan)if(inventory.find(c=>c.id===p.source)?.name!==p.sourceName||inventory.find(c=>c.id===p.target)?.name!==p.targetName)throw Error('Inventory changed; review plan again');
  console.log(JSON.stringify({before:inventory.length,duplicates:plan.length,after:inventory.length-plan.length}));
  if(!process.argv.includes('--apply')&&!process.argv.includes('--verify'))return;
  if(process.env.DATABASE_URL)await db.exec(readFileSync('src/lib/db/migrations/004_contractor_aliases.sql','utf8'));
  const touched=[...new Set(plan.flatMap(p=>[p.source,p.target]))];
  const marks=touched.map(()=>'?').join(',');
  const backup={contractors:inventory.filter(c=>touched.includes(String(c.id))),projects:await db.prepare(`SELECT id,contractor_id FROM projects WHERE contractor_id IN (${marks})`).all(...touched),violations:await db.prepare('SELECT id,reported_contractor_id,project_contractor_id,current_action_owner_id,updated_at FROM violations').all(),users:await db.prepare('SELECT id,contractor_id FROM users').all(),tasks:await db.prepare('SELECT id,owner_id,version FROM tasks').all(),aliases:await db.prepare('SELECT * FROM contractor_aliases').all(),plan};
  mkdirSync('data',{recursive:true});const backupPath=`data/contractor-merge-backup-${Date.now()}.json`;writeFileSync(backupPath,JSON.stringify(backup));
  const now=new Date().toISOString();
  await db.transaction(async()=>{
   const before=await db.prepare('SELECT count(*) total,sum(is_closed) closed,sum(CASE WHEN current_action_owner_id IS NOT NULL THEN 1 ELSE 0 END) assigned FROM violations').get();
   for(const p of plan){
    const source=await db.prepare('SELECT * FROM contractors WHERE id=?').get(p.source);const target=await db.prepare('SELECT * FROM contractors WHERE id=?').get(p.target);
    if(!source||!target||source.name!==p.sourceName)throw Error('Stale merge plan');
    await db.prepare('UPDATE contractor_aliases SET contractor_id=? WHERE contractor_id=?').run(p.target,p.source);
    for(const name of [p.sourceName,p.targetName,p.canonicalName||p.targetName]){
     const existing=await db.prepare('SELECT contractor_id FROM contractor_aliases WHERE alias_name=?').get(name);
     if(existing&&existing.contractor_id!==p.target)throw Error('Conflicting alias');
     await db.prepare('INSERT INTO contractor_aliases(alias_name,normalized_name,contractor_id) VALUES(?,?,?) ON CONFLICT(alias_name) DO NOTHING').run(name,contractorNameKey(name),p.target);
    }
    await db.prepare('UPDATE projects SET contractor_id=? WHERE contractor_id=?').run(p.target,p.source);
    for(const field of ['reported_contractor_id','project_contractor_id','current_action_owner_id'])await db.prepare(`UPDATE violations SET ${field}=?,updated_at=? WHERE ${field}=?`).run(p.target,now,p.source);
    await db.prepare('UPDATE users SET contractor_id=? WHERE contractor_id=?').run(p.target,p.source);
    await db.prepare('UPDATE tasks SET owner_id=?,version=version+1 WHERE owner_id=?').run(p.target,p.source);
    if(p.canonicalName)await db.prepare('UPDATE contractors SET name=? WHERE id=?').run(p.canonicalName,p.target);
    await db.prepare('DELETE FROM contractors WHERE id=?').run(p.source);
    await db.prepare('INSERT INTO audit_events(id,action,entity_type,entity_id,performed_by,details,created_at) VALUES(?,?,?,?,?,?,?)').run(randomUUID(),'CONTRACTOR_MERGED','CONTRACTOR',p.target,null,JSON.stringify({source,target,canonicalName:p.canonicalName||p.targetName,reason:p.reason,backupPath}),now);
   }
   const after=await db.prepare('SELECT count(*) total,sum(is_closed) closed,sum(CASE WHEN current_action_owner_id IS NOT NULL THEN 1 ELSE 0 END) assigned FROM violations').get();
   if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Violation count or state changed; rollback');
   const count=await db.prepare('SELECT count(*) n FROM contractors').get();if(Number(count?.n)!==inventory.length-plan.length)throw Error('Count mismatch');
   if(process.argv.includes('--verify'))throw Error('VERIFIED_ROLLBACK');
  });
  console.log('Merges committed; violation totals and states preserved; backup saved');
 }finally{if(process.env.DATABASE_URL)await postgresPool().end();}
}
void main().catch(e=>{if(e.message==='VERIFIED_ROLLBACK'){console.log('All merges verified in a transaction and rolled back; production records unchanged');return;}console.error(e.message);process.exitCode=1;});
