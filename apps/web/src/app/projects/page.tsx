'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import {
  serviceLabels,
  serviceColors,
  serviceFromReference,
  type ServiceInfo,
  type ServiceType,
} from '@/lib/domain/service-type';
type Project = ServiceInfo & {
  id: string;
  name: string;
  operational_number: string;
  contractor_name: string;
  project_manager_name: string;
  status: string;
  approved_boundaries: number;
};
type Boundary = {
  id: string;
  name: string;
  color: string;
  source_file: string;
  proposed_project_id: string | null;
  approved: number;
  match_method: string;
  candidates_json: string;
};
export default function ProjectsPage() {
  const [service, setService] = useState<ServiceType | 'ALL'>('ALL');
  const [projects, setProjects] = useState<Project[]>([]);
  const [boundaries, setBoundaries] = useState<Boundary[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = async () => {
    const r = await fetch('/api/projects');
    const d = await r.json();
    if (!r.ok) {
      setError(d.message);
      return;
    }
    setProjects(d.projects);
    setBoundaries(d.boundaries);
    setCanWrite(d.can_write);
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load awaits the network; state is set only after the response.
    void load();
  }, []);
  const action = async (body: Record<string, string>) => {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setMessage(
        d.counts
          ? `اكتمل التصنيف: ${d.total} سجل. المرجع ${d.reference_complete ? 'مكتمل' : 'غير مكتمل؛ الخارج غير المؤكد يبقى للمراجعة'}`
          : 'تم حفظ العملية في سجل التدقيق',
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر الحفظ');
    } finally {
      setBusy(false);
    }
  };
  const visibleProjects = projects.filter((p) => service === 'ALL' || p.service_type === service);
  return (
    <AppShell>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">مرجع المشاريع والنطاقات</h2>
        <p className="text-slate-500">
          مصدر المقاول ومدير المتابعة هو ملف بيانات المشاريع. اعتماد الاسم يربط النطاق بمرجع
          المشروع؛ التصنيف نفسه يتم في PostGIS.
        </p>
        {error && (
          <p className="notice-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="surface p-4" role="status">
            {message}
          </p>
        )}
        {canWrite && (
          <div className="flex flex-wrap gap-3">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => action({ action: 'sync-reference' })}
            >
              مزامنة مرجع المشاريع
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => action({ action: 'classify' })}
            >
              {busy ? 'جارٍ التنفيذ…' : 'إعادة التصنيف وفق النطاقات المعتمدة'}
            </button>
          </div>
        )}
        <section className="surface overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <h3 className="font-semibold">
              المشاريع ({visibleProjects.length} من {projects.length})
            </h3>
            <label className="flex items-center gap-2 text-sm">
              نوع المشروع
              <select
                className="field"
                value={service}
                onChange={(e) => setService(e.target.value as ServiceType | 'ALL')}
              >
                <option value="ALL">جميع الأنواع</option>
                {Object.entries(serviceLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label} ({projects.filter((p) => p.service_type === value).length})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="px-4 pb-4 text-xs text-slate-500">
            النوع مستمد من ألوان النطاقات المعتمدة واسم المشروع في المرجع. الاختلافات غير المحسومة
            تظهر للمراجعة.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-start text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    'الرقم التشغيلي',
                    'المشروع',
                    'نوع المشروع',
                    'المقاول',
                    'مدير المتابعة',
                    'الحالة',
                    'النطاقات المعتمدة',
                  ].map((h) => (
                    <th className="p-3 text-start" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleProjects.map((p) => (
                  <tr className="border-t border-slate-100" key={p.id}>
                    <td className="p-3">
                      <bdi>{p.operational_number}</bdi>
                    </td>
                    <td className="max-w-80 p-3">{p.name}</td>
                    <td className="p-3">
                      <span
                        title={p.service_source}
                        className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-slate-50 px-3 py-1"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: serviceColors[p.service_type] }}
                        />
                        {serviceLabels[p.service_type]}
                      </span>
                    </td>
                    <td className="p-3">{p.contractor_name}</td>
                    <td className="p-3">{p.project_manager_name || 'غير محدد'}</td>
                    <td className="p-3">
                      {p.status === 'ACTIVE'
                        ? 'جارٍ'
                        : p.status === 'PRELIMINARY_HANDOVER'
                          ? 'مسلم ابتدائي'
                          : p.status === 'WITHDRAWN'
                            ? 'مسحوب'
                            : 'مراجعة'}
                    </td>
                    <td className="p-3">{p.approved_boundaries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="space-y-3">
          <h3 className="font-semibold">مطابقة نطاقات الطبقات الجارية ({boundaries.length})</h3>
          <p className="text-sm text-slate-500">
            تظهر اختلافات الاسم للمراجعة. لا تعتمد مشروعًا من مجرد تشابه اسم المقاول. لا تُحوّل
            الخطوط أو النقاط إلى حدود.
          </p>
          {boundaries.map((b) => (
            <form
              key={b.id}
              className="surface space-y-3 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void action({
                  action: 'approve',
                  boundary_id: b.id,
                  project_id: String(f.get('project_id')),
                });
              }}
            >
              <div className="flex gap-3">
                <span
                  className="mt-1 h-4 w-4 shrink-0 rounded"
                  style={{ backgroundColor: b.color }}
                />
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {serviceLabels[serviceFromReference(b.color, b.source_file)]} · {b.source_file}{' '}
                    ·{' '}
                    {b.match_method === 'OPERATIONAL_NUMBER'
                      ? 'تطابق الرقم التشغيلي'
                      : b.match_method === 'NORMALIZED_NAME'
                        ? 'تطابق اسم بعد التطبيع'
                        : 'اختلاف يحتاج مراجعة'}
                  </p>
                </div>
                <span className="ms-auto text-sm text-teal-700">
                  {b.approved ? 'معتمد' : 'للمراجعة'}
                </span>
              </div>
              {canWrite && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    aria-label={`المشروع المطابق ${b.name}`}
                    name="project_id"
                    defaultValue={b.proposed_project_id || ''}
                    className="field"
                    required
                  >
                    <option value="">حدد المشروع المطابق من Excel</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.operational_number} — {p.name}
                      </option>
                    ))}
                  </select>
                  <button className="secondary shrink-0" disabled={busy || !!b.approved}>
                    اعتماد الربط
                  </button>
                </div>
              )}
            </form>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
