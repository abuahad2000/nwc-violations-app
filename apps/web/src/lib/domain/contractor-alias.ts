import { db } from '@/lib/db/async';
import { contractorNameKey } from './contractor-name';
export async function findContractor(name: string) {
  const exact = await db.prepare('SELECT id FROM contractors WHERE name=?').get(name);
  if (exact) return exact;
  const aliases = await db
    .prepare('SELECT DISTINCT contractor_id id FROM contractor_aliases WHERE normalized_name=?')
    .all(contractorNameKey(name));
  if (aliases.length > 1) throw Error('اسم المقاول مرتبط بأكثر من جهة؛ يلزم مراجعة الاسم');
  if (aliases.length) return aliases[0];
  const existing = await db.prepare('SELECT id,name FROM contractors').all();
  const matches = existing.filter(
    (c) => contractorNameKey(String(c.name)) === contractorNameKey(name),
  );
  if (matches.length > 1) throw Error('يوجد تكرار يحتاج مراجعة في اسم المقاول');
  return matches[0];
}
export async function saveContractorAlias(name: string, id: string) {
  const old = await db
    .prepare('SELECT contractor_id FROM contractor_aliases WHERE alias_name=?')
    .get(name);
  if (old && old.contractor_id !== id) throw Error('الاسم البديل مرتبط بمقاول آخر');
  await db
    .prepare(
      'INSERT INTO contractor_aliases(alias_name,normalized_name,contractor_id) VALUES(?,?,?) ON CONFLICT(alias_name) DO NOTHING',
    )
    .run(name, contractorNameKey(name), id);
}
