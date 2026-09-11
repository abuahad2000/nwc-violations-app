'use client';
import { useEffect, useState } from 'react';
import {
  Download,
  Mail,
  Printer,
  BriefcaseBusiness,
  CheckCheck,
  Clock3,
  Layers3,
} from 'lucide-react';
import { Sheet } from './ui/sheet';
import { programEmail, type ProgramReport } from '@/lib/domain/program-report';

type ReportData = {
  managers: ProgramReport[];
  unassigned: number;
  unassigned_projects: number;
  unassigned_open: number;
  total: number;
  generated_at: string;
};
const colors = ['#0891b2', '#7c3aed', '#d97706', '#e11d48', '#64748b'];
const number = (n: number) => n.toLocaleString('ar-SA');
function Bars({ title, rows }: { title: string; rows: { name: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="card surface p-5">
      <h3 className="mb-5 font-bold">{title}</h3>
      <div className="space-y-4">
        {rows.length ? (
          rows.map((r, i) => (
            <div key={r.name}>
              <div className="mb-2 flex justify-between gap-3 text-sm">
                <span>{r.name}</span>
                <strong>{number(r.count)}</strong>
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-slate-100"
                role="img"
                aria-label={`${r.name}: ${r.count}`}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(100 * r.count) / max}%`,
                    backgroundColor: colors[i % colors.length],
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">لا توجد بلاغات معلقة.</p>
        )}
      </div>
    </section>
  );
}
export default function ProgramReports() {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [search, setSearch] = useState('');
  const [emailOpen, setEmailOpen] = useState(false);
  const [copyState, setCopyState] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/reports/programs', { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message);
        return d as ReportData;
      })
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, []);
  const manager = data?.managers.find((m) => m.key === selected) || data?.managers[0];
  const date = data
    ? new Date(data.generated_at).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' })
    : '';
  const email = manager ? programEmail(manager, date) : '';
  const exportURL = manager
    ? `/api/reports/export/excel?${new URLSearchParams({ program_manager: manager.key, open: '1' })}`
    : '';
  const downloadEmail = () => {
    const url = URL.createObjectURL(new Blob([email], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'program-pending-email.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (error)
    return (
      <p className="notice-error" role="alert">
        {error}
      </p>
    );
  if (!data)
    return (
      <p role="status" className="card surface p-8">
        جارٍ إعداد تقارير مديري البرامج…
      </p>
    );
  return (
    <div className="space-y-6 program-report">
      <header className="dashboard-hero relative overflow-hidden">
        <div className="mb-3 flex items-center gap-2 text-sm text-cyan-100">
          <BriefcaseBusiness size={18} /> المتابعة التنفيذية / البرامج
        </div>
        <h2 className="font-bold">تقارير مديري البرامج</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
          من مرجع المقاولين والمشاريع إلى تقرير واضح لكل مدير برنامج: حالة البلاغات، توزيع المعالجة،
          وأولويات المتابعة.
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-xs">
          <span className="rounded-full bg-white/15 px-3 py-2">
            {number(data.managers.length)} مدير برنامج
          </span>
          <span className="rounded-full bg-white/15 px-3 py-2">تاريخ التقرير: {date}</span>
        </div>
      </header>
      <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
        {number(data.unassigned_open)} بلاغًا غير مغلق بلا مدير برنامج مرتبط، من أصل{' '}
        {number(data.unassigned)} سجل غير مرتبط. لا تدخل هذه السجلات في أعداد المديرين حتى تثبيت
        ارتباطها بالمشروع.{' '}
        <a
          className="font-bold underline print:hidden"
          href="/api/reports/export/excel?program_manager=__unassigned__&open=1"
        >
          تصدير المعلّق غير المرتبط
        </a>
      </aside>
      {data.unassigned_projects > 0 && (
        <p className="text-sm text-slate-600">
          يوجد {number(data.unassigned_projects)} مشروعًا في المرجع بلا اسم مدير برنامج. الأسماء من
          المرجع مع تطبيق المطابقات المعتمدة؛ تبقى اختلافات الأسماء الأخرى منفصلة حتى اعتمادها.
        </p>
      )}
      <section className="card surface p-5 print:hidden">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            البحث عن مدير برنامج
            <input
              className="form-control field mt-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="اكتب اسم المدير"
            />
          </label>
          <label className="text-sm font-medium">
            مدير البرنامج
            <select
              className="form-control field mt-2"
              value={manager?.key || ''}
              onChange={(e) => {
                setSelected(e.target.value);
                setCopyState('');
              }}
            >
              {data.managers.map((m) => (
                <option value={m.key} key={m.key}>
                  {m.name} — {m.open} معلّق
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 grid max-h-72 gap-3 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
          {data.managers
            .filter((m) => m.name.includes(search.trim()))
            .map((m) => (
              <button
                key={m.key}
                aria-pressed={manager?.key === m.key}
                onClick={() => {
                  setSelected(m.key);
                  setCopyState('');
                }}
                className={`rounded-xl border p-4 text-start transition-colors ${manager?.key === m.key ? 'border-cyan-600 bg-cyan-50' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <span className="block font-bold">{m.name}</span>
                <span className="mt-2 block text-xs text-slate-600">
                  {number(m.projects.length)} مشروع · {number(m.open)} معلّق · {number(m.closed)}{' '}
                  مغلق
                </span>
              </button>
            ))}
        </div>
      </section>
      {!manager && <p className="card surface p-6">لا توجد أسماء مديري برامج في المرجع الحالي.</p>}
      {manager && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-semibold text-cyan-700">تقرير البرنامج المحدد</p>
              <h3 className="text-2xl font-bold">{manager.name}</h3>
              <p className="mt-2 text-xs text-slate-500">
                المعلّق = جميع البلاغات غير المغلقة. المقاول مسؤول التنفيذ ومدير البرنامج للمتابعة.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <button className="btn secondary" onClick={() => window.print()}>
                <Printer size={17} />
                طباعة / PDF
              </button>
              <a className="btn secondary" href={exportURL}>
                <Download size={17} />
                Excel المعلّق
              </a>
              <button className="btn btn-primary primary" onClick={() => setEmailOpen(true)}>
                <Mail size={17} />
                صيغة البريد
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              {
                label: 'المشاريع في المرجع',
                value: manager.projects.length,
                icon: Layers3,
                color: 'text-cyan-700 bg-cyan-50',
              },
              {
                label: 'البلاغات غير المغلقة',
                value: manager.open,
                icon: Clock3,
                color: 'text-amber-700 bg-amber-50',
              },
              {
                label: 'تمت المعالجة / مغلق',
                value: manager.closed,
                icon: CheckCheck,
                color: 'text-emerald-700 bg-emerald-50',
              },
              {
                label: 'أكثر من 180 يومًا',
                value: manager.over180,
                icon: Clock3,
                color: 'text-rose-700 bg-rose-50',
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div className="card surface p-5" key={label}>
                <span className={`mb-4 inline-flex rounded-xl p-2 ${color}`}>
                  <Icon size={21} />
                </span>
                <p className="text-xs text-slate-500">{label}</p>
                <strong className="mt-2 block text-3xl">{number(value)}</strong>
              </div>
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <section className="card surface p-5">
              <h3 className="font-bold">نسبة إغلاق البلاغات</h3>
              <div
                className="mx-auto my-5 grid h-40 w-40 place-items-center rounded-full"
                style={{
                  background: `conic-gradient(#0891b2 ${manager.total ? (manager.closed / manager.total) * 100 : 0}%, #e2e8f0 0)`,
                }}
                role="img"
                aria-label={`مغلق ${manager.closed} من ${manager.total}`}
              >
                <div className="grid h-28 w-28 place-content-center rounded-full bg-white text-center">
                  <strong className="text-3xl">
                    {manager.total
                      ? number(Math.round((manager.closed / manager.total) * 100)) + '٪'
                      : '—'}
                  </strong>
                  <span className="mt-1 text-xs text-slate-500">نسبة الإغلاق</span>
                </div>
              </div>
              <p className="text-center text-sm">
                {number(manager.closed)} مغلق من {number(manager.total)} بلاغ
              </p>
            </section>
            <Bars title="المعلّق بحسب حالة المصدر" rows={manager.statuses} />
            <Bars title="أعمار البلاغات المعلقة" rows={manager.aging} />
          </div>
          <Bars
            title="البلاغات المعلقة حسب المشروع"
            rows={Object.values(
              manager.pending.reduce<Record<string, { name: string; count: number }>>((a, r) => {
                const key = r.project_id || '';
                a[key] ??= { name: r.project_name || 'غير محدد', count: 0 };
                a[key].count++;
                return a;
              }, {}),
            ).sort((a, b) => b.count - a.count)}
          />
          <section className="card surface overflow-hidden">
            <h3 className="p-5 font-bold">
              مشاريع البرنامج ومديرو المتابعة ({number(manager.projects.length)})
            </h3>
            <div className="overflow-x-auto">
              <table className="table table-vcenter report-table">
                <thead>
                  <tr>
                    {['الرقم التشغيلي', 'المشروع', 'المقاول', 'مدير المشروع', 'الحالة'].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {manager.projects.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <bdi>{p.operational_number}</bdi>
                      </td>
                      <td>{p.name}</td>
                      <td>{p.contractor_name}</td>
                      <td>{p.project_manager_name || 'غير محدد'}</td>
                      <td>
                        {p.status === 'ACTIVE'
                          ? 'جارٍ'
                          : p.status === 'WITHDRAWN'
                            ? 'مسحوب'
                            : p.status === 'PRELIMINARY_HANDOVER'
                              ? 'مسلم ابتدائي'
                              : 'مراجعة'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card surface overflow-hidden">
            <h3 className="p-5 font-bold">تفاصيل البلاغات المعلقة ({number(manager.open)})</h3>
            {!manager.open ? (
              <p className="px-5 pb-5 text-sm text-emerald-700">
                لا توجد بلاغات معلقة مرتبطة بهذا المدير حاليًا.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-vcenter report-table">
                  <thead>
                    <tr>
                      {[
                        'البلاغ',
                        'المشروع / المقاول',
                        'مدير المشروع',
                        'الحي',
                        'حالة المصدر',
                        'تاريخ البلاغ',
                        'العمر بالأيام',
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {manager.pending.map((r) => (
                      <tr key={r.id}>
                        <td className="font-bold text-cyan-800">
                          <bdi>{r.source_reference}</bdi>
                        </td>
                        <td>
                          {r.project_name}
                          <span className="mt-1 block text-xs text-slate-500">
                            {r.contractor_name}
                          </span>
                        </td>
                        <td>{r.project_manager_name || 'غير محدد'}</td>
                        <td>{r.district_raw || 'غير محدد'}</td>
                        <td>{r.source_status}</td>
                        <td>
                          <bdi>{r.reported_date || 'غير محدد'}</bdi>
                        </td>
                        <td
                          className={
                            r.age_days !== null && r.age_days > 180 ? 'font-bold text-rose-700' : ''
                          }
                        >
                          {r.age_days === null ? 'غير محدد' : number(r.age_days)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      <Sheet
        open={emailOpen}
        onOpenChange={setEmailOpen}
        title={`صيغة بريد — ${manager?.name || ''}`}
      >
        <p className="mb-4 text-sm text-slate-500">
          صيغة جاهزة للنسخ مع كامل البلاغات المعلقة. راجعها وحدد بريد المستلم في تطبيق البريد.
        </p>
        <label className="text-sm">
          نص البريد
          <textarea className="form-control field mt-2 min-h-96 leading-7" readOnly value={email} />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="btn btn-primary primary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(email);
                setCopyState('تم نسخ نص البريد كاملًا');
              } catch {
                setCopyState('تعذر النسخ؛ يمكنك تحديد النص أو تنزيله.');
              }
            }}
          >
            نسخ البريد
          </button>
          <button className="btn secondary" onClick={downloadEmail}>
            تنزيل النص
          </button>
          <a className="btn secondary" href={exportURL}>
            تنزيل Excel للإرفاق
          </a>
        </div>
        <p className="mt-3 text-sm" role="status">
          {copyState}
        </p>
      </Sheet>
    </div>
  );
}
