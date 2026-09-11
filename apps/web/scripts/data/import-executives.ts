import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import XLSX from 'xlsx';
import { db, postgresPool } from '../../src/lib/db/async';
async function main() {
const path = process.argv[2];
if (!path) throw Error('Pass the contractor reference workbook path; add --apply to persist');
const workbook = XLSX.read(readFileSync(path));
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]]);
const source = new Map<string, { executive: string; subprogram: string }>();
for (const row of rows) {
  const key = String(row['الرقم التشغيلي'] || '').trim();
  if (!key) continue;
  if (source.has(key)) throw Error('Duplicate operational number in source');
  source.set(key, {executive:String(row['المدير التنفيذي'] || '').trim(),subprogram:String(row['البرنامج الفرعي'] || '').trim()});
}
try {
  const projects=await db.prepare("SELECT id,operational_number FROM projects WHERE status!='REVIEW'").all();
  const matched=projects.filter(p=>source.has(String(p.operational_number).trim()));
  if(matched.length!==projects.length)throw Error(`Only ${matched.length}/${projects.length} projects match; nothing changed`);
  console.log(JSON.stringify({projects:projects.length,matched:matched.length,executives:[...new Set([...source.values()].map(r=>r.executive))]}));
  if(process.argv.includes('--apply')) {
    if(process.env.DATABASE_URL) await db.exec(readFileSync('src/lib/db/migrations/003_project_executives.sql','utf8'));
    const before=await db.prepare('SELECT id,executive_director_name,subprogram_name FROM projects').all();
    mkdirSync('data',{recursive:true});writeFileSync(`data/executives-before-${Date.now()}.json`,JSON.stringify(before));
    await db.transaction(async()=>{
      for(const p of matched){const r=source.get(String(p.operational_number).trim())!;await db.prepare('UPDATE projects SET executive_director_name=?,subprogram_name=? WHERE id=?').run(r.executive,r.subprogram,String(p.id));}
    });
    console.log('Executive hierarchy imported by exact operational number');
  }
}finally{if(process.env.DATABASE_URL)await postgresPool().end();}
}
void main().catch(e=>{console.error(e.message);process.exitCode=1;});
