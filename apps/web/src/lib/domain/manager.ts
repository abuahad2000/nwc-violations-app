// Normalize typography only. Do not infer identity from abbreviated surnames.
const name = "trim(COALESCE(p.project_manager_name,''))";
const withoutTitle = `trim(CASE WHEN substr(${name},1,2) IN ('م.','م/','م ') THEN substr(${name},3) ELSE ${name} END)`;
export const managerKeySQL = `replace(replace(replace(replace(replace(${withoutTitle},'أ','ا'),'إ','ا'),'آ','ا'),'ى','ي'),'  ',' ')`;
export const programKeySQL = managerKeySQL.replaceAll(
  'p.project_manager_name',
  'p.program_manager_name',
);

export type ManagerSummary = {
  key: string;
  name: string;
  total: number;
  processing: number;
  contractor: number;
  closed: number;
  other: number;
};
export type StatusCount = { status: string; count: number };
export const PROCESSING_STATUSES = ['تحت معالجة المقاول', 'تحت معالجة الجهة المتعدية'];

export function summarizeManagers(
  roster: { key: string; name: string }[],
  groups: { key: string; name: string; status: string; count: number; closed: number }[],
) {
  const managers = new Map<string, ManagerSummary>();
  for (const person of roster)
    if (person.key)
      managers.set(person.key, {
        ...person,
        total: 0,
        processing: 0,
        contractor: 0,
        closed: 0,
        other: 0,
      });
  let unassigned = 0;
  for (const row of groups) {
    if (!row.key) {
      unassigned += row.count;
      continue;
    }
    const m = managers.get(row.key) || {
      key: row.key,
      name: row.name,
      total: 0,
      processing: 0,
      contractor: 0,
      closed: 0,
      other: 0,
    };
    m.total += row.count;
    m.closed += row.closed;
    const open = row.count - row.closed;
    if (PROCESSING_STATUSES.includes(row.status)) m.processing += open;
    else m.other += open;
    if (row.status === 'تحت معالجة المقاول') m.contractor += open;
    managers.set(row.key, m);
  }
  return {
    managers: [...managers.values()].sort(
      (a, b) => b.total - a.total || a.name.localeCompare(b.name, 'ar'),
    ),
    unassigned,
  };
}
