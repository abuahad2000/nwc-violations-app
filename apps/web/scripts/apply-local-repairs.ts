import {initializeReference,approveBoundary} from '../src/lib/spatial/reference';
import {reclassify} from '../src/lib/spatial/reclassify';
import {db} from '../src/lib/db';
import {postgis} from '../src/lib/spatial/postgis';
async function main(){
 const actor='OWNER_AUTHORIZATION_20260911';
 console.log('Reference:',initializeReference(actor));
 // Only the explicit running-layer colors AND active workbook status qualify.
 // Conflicting statuses remain for owner decision; approximate matches are never silently accepted.
 const candidates=db.prepare("SELECT b.id,b.proposed_project_id FROM reference_candidates b JOIN projects p ON p.id=b.proposed_project_id WHERE b.color IN ('#097138','#01579b') AND p.status='ACTIVE' AND b.match_method IN ('OPERATIONAL_NUMBER','NORMALIZED_NAME') AND b.approved=0").all();
 let approved=0;const invalid:string[]=[];
 for(const c of candidates){try{await approveBoundary(String(c.id),String(c.proposed_project_id),actor);approved++;}catch{invalid.push(String(c.id));}}
 console.log(JSON.stringify({approved,invalid}));
 console.log(JSON.stringify(await reclassify(actor),null,2));
 console.log('Source status:',db.prepare("SELECT count(*) total,sum(is_closed=1) closed,sum(is_closed=0) open FROM violations").get());
 await postgis().end();
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Repair failed');process.exitCode=1;});
