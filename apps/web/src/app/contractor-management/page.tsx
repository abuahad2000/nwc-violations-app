'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
type Contractor = { id: string; name: string; version: string };
type Project = {
  id: string;
  name: string;
  operational_number: string;
  contractor_id: string;
  version: string;
  project_manager_name: string | null;
  program_manager_name: string | null;
  executive_director_name: string | null;
  subprogram_name: string | null;
};
const fields = [
  ['project_manager_name', 'مدير المشروع'],
  ['program_manager_name', 'مدير البرنامج'],
  ['executive_director_name', 'المدير التنفيذي'],
  ['subprogram_name', 'الإدارة / البرنامج الفرعي'],
] as const;
export default function ContractorManagement() {
  const [data, setData] = useState<{ contractors: Contractor[]; projects: Project[] } | null>(null);
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/contractor-management', { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.message);
        setData(d);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, []);
  const save = async (kind: 'contractor' | 'project') => {
    const item = kind === 'contractor' ? contractor : project;
    if (!item) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const payload =
        kind === 'contractor'
          ? { kind, id: item.id, version: item.version, name: contractor!.name }
          : {
              kind,
              id: item.id,
              version: item.version,
              ...Object.fromEntries(fields.map(([key]) => [key, project![key] || ''])),
            };
      const r = await fetch('/api/contractor-management', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.message);
      if (kind === 'contractor') {
        setContractor(d.record);
        setData((old) =>
          old
            ? { ...old, contractors: old.contractors.map((c) => (c.id === item.id ? d.record : c)) }
            : old,
        );
      } else {
        setProject(d.record);
        setData((old) =>
          old
            ? { ...old, projects: old.projects.map((p) => (p.id === item.id ? d.record : p)) }
            : old,
        );
      }
      setMessage(d.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر الحفظ');
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppShell>
      <div className="space-y-5">
        <header className="rounded-2xl bg-[#182433] p-6">
          <h2 className="text-2xl font-bold text-white">
            تعديل بيانات المقاولين والتبعية الإدارية
          </h2>
          <p className="mt-3 text-slate-200">
            اختر المقاول ثم المشروع لتحديث المدير والإدارة التابعة له. تنعكس التغييرات على التقارير
            والتصدير.
          </p>
        </header>
        {error && (
          <p role="alert" className="notice-error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">
            {message}
          </p>
        )}
        {data ? (
          <>
            <section className="card surface space-y-4 p-5">
              <label className="block">
                البحث عن مقاول
                <input
                  className="form-control field mt-2"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="اسم المقاول"
                  disabled={busy}
                />
              </label>
              <label className="block">
                اختيار المقاول
                <select
                  className="form-control field mt-2"
                  value={contractor?.id || ''}
                  disabled={busy}
                  onChange={(e) => {
                    setContractor(data.contractors.find((c) => c.id === e.target.value) || null);
                    setProject(null);
                    setMessage('');
                    setError('');
                  }}
                >
                  <option value="">اختر المقاول</option>
                  {data.contractors
                    .filter((c) => c.id === contractor?.id || c.name.includes(search))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            </section>
            {contractor && (
              <>
                <form
                  className="card surface space-y-4 p-5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save('contractor');
                  }}
                >
                  <h3 className="text-xl font-bold">بيانات المقاول</h3>
                  <label className="block">
                    اسم المقاول
                    <input
                      required
                      maxLength={200}
                      className="form-control field mt-2"
                      value={contractor.name}
                      disabled={busy}
                      onChange={(e) => setContractor({ ...contractor, name: e.target.value })}
                    />
                  </label>
                  <button disabled={busy} className="btn primary">
                    حفظ اسم المقاول
                  </button>
                </form>
                <section className="card surface space-y-4 p-5">
                  <label className="block">
                    اختيار المشروع
                    <select
                      className="form-control field mt-2"
                      value={project?.id || ''}
                      disabled={busy}
                      onChange={(e) => {
                        setProject(data.projects.find((p) => p.id === e.target.value) || null);
                        setMessage('');
                      }}
                    >
                      <option value="">اختر مشروعًا لتعديل التبعية</option>
                      {data.projects
                        .filter((p) => p.contractor_id === contractor.id)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {p.operational_number}
                          </option>
                        ))}
                    </select>
                  </label>
                  {project && (
                    <form
                      className="space-y-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void save('project');
                      }}
                    >
                      <p className="text-sm text-slate-600">
                        الرقم التشغيلي: <bdi>{project.operational_number}</bdi>
                      </p>
                      <div className="grid gap-4 md:grid-cols-2">
                        {fields.map(([key, label]) => (
                          <label key={key}>
                            {label}
                            <input
                              className="form-control field mt-2"
                              maxLength={200}
                              list={'suggest-' + key}
                              disabled={busy}
                              value={project[key] || ''}
                              onChange={(e) => setProject({ ...project, [key]: e.target.value })}
                            />
                            <datalist id={'suggest-' + key}>
                              {[...new Set(data.projects.map((p) => p[key]).filter(Boolean))].map(
                                (value) => (
                                  <option key={value} value={value!} />
                                ),
                              )}
                            </datalist>
                          </label>
                        ))}
                      </div>
                      <button className="btn primary" disabled={busy}>
                        حفظ التبعية الإدارية
                      </button>
                      <p className="text-sm text-slate-500">
                        تُسجّل القيم السابقة والجديدة في سجل التعديلات.
                      </p>
                    </form>
                  )}
                  {!data.projects.some((p) => p.contractor_id === contractor.id) && (
                    <p>لا توجد مشاريع مرتبطة بهذا المقاول.</p>
                  )}
                </section>
              </>
            )}
          </>
        ) : (
          !error && <p role="status">جارٍ تحميل البيانات…</p>
        )}
      </div>
    </AppShell>
  );
}
