import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {initialResponsibility,type ResponsibilityProject} from '../../src/lib/domain/responsibility';
async function main(){
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});const client=await pool.connect();
 try{
  await client.query(readFileSync('src/lib/db/migrations/005_manual_responsibility.sql','utf8'));
  const projects=(await client.query("SELECT id,name,contractor_id FROM projects WHERE status!='REVIEW'")).rows as ResponsibilityProject[];
  const rows=(await client.query('SELECT * FROM violations WHERE current_action_owner_id IS NULL ORDER BY id')).rows;
  const plan=rows.map(r=>({...initialResponsibility(r,projects),id:r.id,expected_updated_at:r.updated_at,is_closed:r.is_closed,task_id:randomUUID()}));
  const summary={count:plan.length,project:plan.filter(r=>r.project_id).length,contractorPendingProject:plan.filter(r=>!r.project_id&&r.owner_id!=='cont_nwc_operations').length,maintenance:plan.filter(r=>r.owner_id==='cont_nwc_operations').length};console.log(JSON.stringify(summary));
  if((!process.argv.includes('--apply')&&!process.argv.includes('--verify'))||!plan.length)return;
  mkdirSync('data',{recursive:true});const backupPath=`data/responsibility-before-${Date.now()}.json`;writeFileSync(backupPath,JSON.stringify({rows,plan,summary}));
  const user=(await client.query("SELECT id FROM users WHERE username='admin'")).rows[0];if(!user)throw Error('Admin account missing');
  const now=new Date().toISOString();await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  try{
   const before=(await client.query('SELECT count(*) total,sum(is_closed) closed FROM violations')).rows[0];
   await client.query('CREATE TEMP TABLE assignment_plan ON COMMIT DROP AS SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(id text,project_id text,owner_id text,reason text,expected_updated_at text,is_closed int,task_id text)',[JSON.stringify(plan)]);
   const invalid=await client.query('SELECT p.id FROM assignment_plan p LEFT JOIN contractors c ON c.id=p.owner_id WHERE c.id IS NULL');if(invalid.rowCount)throw Error('Missing responsible entity');
   const changed=await client.query(`UPDATE violations v SET current_action_owner_id=p.owner_id,project_id=p.project_id,project_contractor_id=CASE WHEN p.project_id IS NULL THEN NULL ELSE p.owner_id END,classification_reason=CASE WHEN v.project_id IS DISTINCT FROM p.project_id THEN p.reason ELSE v.classification_reason END,updated_at=$1 FROM assignment_plan p WHERE v.id=p.id AND v.current_action_owner_id IS NULL AND v.updated_at=p.expected_updated_at`,[now]);if(changed.rowCount!==plan.length)throw Error('Concurrent changes; stopped without partial assignment');
   await client.query("UPDATE tasks SET status='SUPERSEDED',version=version+1 WHERE status='OPEN' AND violation_id IN(SELECT id FROM assignment_plan)");
   await client.query("INSERT INTO tasks(id,violation_id,owner_id,reason,status,version,created_by,created_at) SELECT task_id,id,owner_id,reason,'OPEN',1,$1,$2 FROM assignment_plan WHERE is_closed=0",[user.id,now]);
   await client.query('INSERT INTO audit_events(id,action,entity_type,entity_id,performed_by,details,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),'INITIAL_RESPONSIBILITY_BATCH','VIOLATION_BATCH',randomUUID(),user.id,JSON.stringify({summary,backupPath,violation_ids:plan.map(r=>r.id)}),now]);
   const after=(await client.query('SELECT count(*) total,sum(is_closed) closed FROM violations')).rows[0];if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Record states changed');
   const missing=await client.query('SELECT count(*) n FROM violations WHERE current_action_owner_id IS NULL');if(Number(missing.rows[0].n))throw Error('Unassigned records remain');
   if(process.argv.includes('--verify')){await client.query('ROLLBACK');console.log('Verified all assignments in transaction and rolled back');return;}
   await client.query('COMMIT');console.log('All records have a responsible entity; source contractors and closure states preserved');
  }catch(e){await client.query('ROLLBACK');throw e;}
 }finally{client.release();await pool.end();}
}
void main().catch(e=>{console.error(e.message);process.exitCode=1;});
