export type ProgramProject = {
  id: string;
  name: string;
  operational_number: string;
  contractor_name: string;
  project_manager_name: string;
  program_manager_name: string;
  program_key: string;
  status: string;
};
export type ProgramViolation = {
  id: string;
  source_reference: string;
  project_id: string | null;
  source_status: string;
  is_closed: number;
  age_days: number | null;
  district_raw: string | null;
  reported_date: string | null;
  project_name: string | null;
  contractor_name: string | null;
  project_manager_name: string | null;
  program_key: string;
  program_manager_name: string | null;
};
export type ProgramReport = {
  key: string;
  name: string;
  projects: ProgramProject[];
  pending: ProgramViolation[];
  total: number;
  closed: number;
  open: number;
  contractor: number;
  over180: number;
  statuses: { name: string; count: number }[];
  aging: { name: string; count: number }[];
};
export function buildProgramReports(projects: ProgramProject[], rows: ProgramViolation[]) {
  const managers = new Map<string, ProgramReport>();
  const get = (key: string, name: string) => {
    let m = managers.get(key);
    if (!m) {
      m = {
        key,
        name,
        projects: [],
        pending: [],
        total: 0,
        closed: 0,
        open: 0,
        contractor: 0,
        over180: 0,
        statuses: [],
        aging: [
          { name: 'حتى 30 يومًا', count: 0 },
          { name: '31–90 يومًا', count: 0 },
          { name: '91–180 يومًا', count: 0 },
          { name: 'أكثر من 180 يومًا', count: 0 },
          { name: 'تاريخ غير محدد', count: 0 },
        ],
      };
      managers.set(key, m);
    }
    return m;
  };
  for (const p of projects)
    if (p.program_key) get(p.program_key, p.program_manager_name).projects.push(p);
  let unassigned = 0,
    unassignedOpen = 0;
  for (const r of rows) {
    if (!r.program_key) {
      unassigned++;
      if (!r.is_closed) unassignedOpen++;
      continue;
    }
    const m = get(r.program_key, r.program_manager_name || r.program_key);
    m.total++;
    if (r.is_closed) {
      m.closed++;
      continue;
    }
    m.open++;
    m.pending.push(r);
    if (r.source_status === 'تحت معالجة المقاول') m.contractor++;
    if (r.age_days !== null && r.age_days > 180) m.over180++;
    const status = m.statuses.find((s) => s.name === r.source_status);
    if (status) status.count++;
    else m.statuses.push({ name: r.source_status, count: 1 });
    m.aging[
      r.age_days === null || r.age_days < 0
        ? 4
        : r.age_days <= 30
          ? 0
          : r.age_days <= 90
            ? 1
            : r.age_days <= 180
              ? 2
              : 3
    ].count++;
  }
  for (const m of managers.values()) {
    m.pending.sort(
      (a, b) =>
        (b.age_days ?? -1) - (a.age_days ?? -1) ||
        a.source_reference.localeCompare(b.source_reference, 'ar'),
    );
    m.statuses.sort((a, b) => b.count - a.count);
  }
  return {
    managers: [...managers.values()].sort(
      (a, b) => b.open - a.open || a.name.localeCompare(b.name, 'ar'),
    ),
    unassigned,
    unassigned_projects: projects.filter((p) => !p.program_key).length,
    unassigned_open: unassignedOpen,
    total: rows.length,
  };
}
export function programEmail(m: ProgramReport, date: string) {
  return `الموضوع: متابعة البلاغات المعلقة — ${m.name} — ${date}\n\nسعادة مدير البرنامج / ${m.name}\nالسلام عليكم ورحمة الله وبركاته،\n\nوفق بيانات النظام المتاحة عند إعداد التقرير بتاريخ ${date}، بلغ عدد البلاغات غير المغلقة المرتبطة بمشاريع برنامجكم ${m.open} بلاغًا، منها ${m.contractor} تحت معالجة المقاول و${m.over180} مضى عليها أكثر من 180 يومًا.\n\nنأمل التكرم بمتابعة المقاولين ومديري المشاريع، وتزويدنا بالإجراء المتخذ والموعد المتوقع للمعالجة لكل بلاغ.\n\nالبلاغات المعلقة:\n${m.pending.length ? m.pending.map((r, i) => `${i + 1}. البلاغ ${r.source_reference} | المشروع: ${r.project_name || 'غير محدد'} | المقاول: ${r.contractor_name || 'غير محدد'} | مدير المشروع: ${r.project_manager_name || 'غير محدد'} | الحالة: ${r.source_status} | العمر: ${r.age_days === null ? 'غير محدد' : r.age_days + ' يومًا'} | الحي: ${r.district_raw || 'غير محدد'}`).join('\n') : 'لا توجد بلاغات غير مغلقة مرتبطة ببرنامجكم حاليًا.'}\n\nيشمل التقرير البلاغات المرتبطة بالمشاريع المعتمدة فقط؛ البلاغات التي تحتاج تحققًا من الارتباط مدرجة بصورة مستقلة في النظام.\nوتفضلوا بقبول التحية والتقدير.\n[اسم المرسل]\n[الإدارة / بيانات التواصل]`;
}
