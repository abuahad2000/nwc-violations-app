export type ProgramCounts = { total: number; pending: number; contractor: number };
export type ProgramDashboardRow = ProgramCounts & {
  program_key: string;
  program_name: string;
  manager_key: string;
  manager_name: string;
};
export type ProgramDashboard = ReturnType<typeof summarizeProgramDashboard> & {
  executives: ReturnType<typeof executiveHierarchy>;
};
export function summarizeProgramDashboard(
  roster: Omit<ProgramDashboardRow, keyof ProgramCounts>[],
  rows: ProgramDashboardRow[],
) {
  const programs = new Map<
    string,
    {
      key: string;
      name: string;
      total: number;
      pending: number;
      contractor: number;
      managers: Map<string, ProgramCounts & { key: string; name: string }>;
    }
  >();
  const unassigned: ProgramCounts = { total: 0, pending: 0, contractor: 0 };
  const ensure = (r: Omit<ProgramDashboardRow, keyof ProgramCounts>) => {
    if (!programs.has(r.program_key))
      programs.set(r.program_key, {
        key: r.program_key,
        name: r.program_name,
        total: 0,
        pending: 0,
        contractor: 0,
        managers: new Map(),
      });
    const program = programs.get(r.program_key)!;
    if (!program.managers.has(r.manager_key))
      program.managers.set(r.manager_key, {
        key: r.manager_key,
        name: r.manager_name || 'مدير مشروع غير محدد',
        total: 0,
        pending: 0,
        contractor: 0,
      });
    return program;
  };
  for (const r of roster) if (r.program_key) ensure(r);
  for (const r of rows) {
    if (!r.program_key) {
      unassigned.total += r.total;
      unassigned.pending += r.pending;
      unassigned.contractor += r.contractor;
      continue;
    }
    const p = ensure(r),
      m = p.managers.get(r.manager_key)!;
    for (const k of ['total', 'pending', 'contractor'] as const) {
      p[k] += r[k];
      m[k] += r[k];
    }
  }
  const compare = (a: { pending: number; name: string }, b: { pending: number; name: string }) =>
    b.pending - a.pending || a.name.localeCompare(b.name, 'ar');
  const data = [...programs.values()]
    .filter((p) => p.total > 0)
    .map((p) => ({
      ...p,
      managers: [...p.managers.values()].filter((m) => m.total > 0).sort(compare),
    }))
    .sort(compare);
  return {
    programs: data,
    unassigned,
    assigned: data.reduce(
      (s, p) => ({
        total: s.total + p.total,
        pending: s.pending + p.pending,
        contractor: s.contractor + p.contractor,
      }),
      { total: 0, pending: 0, contractor: 0 },
    ),
  };
}
export function executiveHierarchy(
  rows: (ProgramDashboardRow & { executive: string; subprogram: string })[],
) {
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.executive || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  return [...groups]
    .map(([key, items]) => {
      const report = summarizeProgramDashboard([], items);
      return {
        key: key || '__unassigned__',
        name: key || 'مدير تنفيذي غير محدد',
        categories: [...new Set(items.map((r) => r.subprogram).filter(Boolean))],
        ...report,
      };
    })
    .filter((e) => e.assigned.total > 0 || e.unassigned.total > 0)
    .sort((a, b) => b.assigned.pending - a.assigned.pending);
}
