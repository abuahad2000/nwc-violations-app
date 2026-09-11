import fs from 'node:fs/promises';
import path from 'node:path';
import {previewImport,commitImport} from '../../src/lib/imports/service';
const actor='LOCAL_AUTHORIZED_OPERATOR';
async function main(){const [command,id]=process.argv.slice(2);if(command==='--commit'&&id){console.log(commitImport(id,actor));return;}const file=path.resolve('../../excel/التعديات.xlsx');const preview=await previewImport(await fs.readFile(file),'التعديات.xlsx',actor);console.log(JSON.stringify({preview_id:preview.preview_id,total:preview.total_rows,added:preview.added,changed:preview.changed,unchanged:preview.unchanged,duplicate:preview.is_duplicate},null,2));console.log('Commit only after reviewing: npm run import:local -- --commit <preview_id>');}
main().catch(()=>{console.error('Import failed; review input and database configuration.');process.exitCode=1;});
