'use client';
import { useEffect, useState } from 'react';
import { Building2, ClipboardList, CheckCheck, Clock3, Download, Printer } from 'lucide-react';
import { infographicSVG, type InfographicData } from '@/lib/domain/infographic';
const number = (v: number) => v.toLocaleString('ar-SA');
export default function ProjectInfographic() {
  const [data, setData] = useState<InfographicData | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/reports/infographic', { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.message);
        return d;
      })
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, []);
  if (error)
    return (
      <p role="alert" className="notice-error">
        {error}
      </p>
    );
  if (!data) return <p role="status">جارٍ إعداد الإنفوجرافيك…</p>;
  const max = Math.max(1, ...data.contractors.map((c) => c.pending));
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([infographicSVG(data)], { type: 'image/svg+xml;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'projects-pending-infographic.svg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="space-y-6 infographic-report">
      <header className="rounded-2xl bg-[#182433] p-6 text-white">
        <div className="flex flex-wrap justify-between gap-5">
          <div>
            <p className="mb-2 text-sm text-cyan-200">صورة شاملة للمتابعة</p>
            <h2 className="text-3xl font-bold text-white">إنفوجرافيك المشاريع والتعديات</h2>
            <p className="mt-3 text-sm text-slate-300">
              تاريخ التقرير:{' '}
              {new Date(data.generated_at).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' })}
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2 print:hidden">
            <button className="btn secondary text-slate-800" onClick={download}>
              <Download size={17} />
              تنزيل الإنفوجرافيك SVG
            </button>
            <button className="btn secondary text-slate-800" onClick={() => window.print()}>
              <Printer size={17} />
              طباعة / PDF
            </button>
          </div>
        </div>
      </header>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          {
            label: 'المشاريع في المرجع',
            value: data.projects.length,
            icon: Building2,
            color: 'text-blue-700 bg-blue-50',
          },
          {
            label: 'البلاغات المعلقة',
            value: data.summary.pending,
            icon: ClipboardList,
            color: 'text-amber-700 bg-amber-50',
          },
          {
            label: 'تمت المعالجة',
            value: data.summary.closed,
            icon: CheckCheck,
            color: 'text-emerald-700 bg-emerald-50',
          },
          {
            label: 'أكثر من 180 يومًا',
            value: data.summary.over180,
            icon: Clock3,
            color: 'text-rose-700 bg-rose-50',
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <section className="card surface p-5" key={label}>
            <span className={`mb-4 inline-flex w-fit rounded-xl p-3 ${color}`}>
              <Icon size={25} />
            </span>
            <p className="text-sm text-slate-500">{label}</p>
            <strong className="mt-2 text-4xl">{number(value)}</strong>
          </section>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card surface p-6">
          <h3 className="text-xl font-bold">إنجاز معالجة البلاغات</h3>
          <div
            role="img"
            aria-label={`مغلق ${data.summary.closed} من ${data.summary.total}`}
            className="mx-auto my-5 grid h-40 w-40 place-items-center rounded-full"
            style={{
              background: `conic-gradient(#0891b2 ${data.summary.total ? (100 * data.summary.closed) / data.summary.total : 0}%,#e2e8f0 0)`,
            }}
          >
            <div className="grid h-28 w-28 place-content-center rounded-full bg-white text-center">
              <strong className="text-3xl">
                {number(
                  data.summary.total
                    ? Math.round((100 * data.summary.closed) / data.summary.total)
                    : 0,
                )}
                ٪
              </strong>
              <span className="text-sm text-slate-500">تمت المعالجة</span>
            </div>
          </div>
          <p className="text-center text-sm">من إجمالي {number(data.summary.total)} بلاغ</p>
        </section>
        <section className="card surface p-6 lg:col-span-2">
          <h3 className="text-xl font-bold">توزيع المشاريع في المرجع</h3>
          <div className="mt-6 space-y-5">
            {[
              ['ACTIVE', 'مشاريع جارية', '#206bc4'],
              ['PRELIMINARY_HANDOVER', 'مسلمة ابتدائيًا', '#0891b2'],
              ['WITHDRAWN', 'مشاريع مسحوبة', '#d97706'],
            ].map(([status, label, color]) => {
              const count = data.projects.filter((p) => p.status === status).length;
              return (
                <div key={status}>
                  <p className="mb-2 flex justify-between text-sm">
                    <span>{label}</span>
                    <strong>{number(count)}</strong>
                  </p>
                  <div
                    className="h-3 rounded-full bg-slate-100"
                    role="img"
                    aria-label={`${label}: ${count}`}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(100 * count) / Math.max(1, data.projects.length)}%`,
                        background: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <aside className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
        <strong>{number(data.summary.unassigned)} بلاغًا معلّقًا بلا مقاول مسند.</strong> ترتيب
        المقاولين يعتمد على مسؤول الإجراء الحالي للبلاغات غير المغلقة، ولا ينسب البلاغ إلى مقاول من
        اسم المصدر وحده. المعلّق يشمل كل بلاغ غير مغلق.
      </aside>
      <section className="card surface p-6">
        <div className="mb-6 flex flex-wrap justify-between gap-2">
          <h3 className="text-xl font-bold">أكثر المقاولين لديهم بلاغات معلقة</h3>
          <span className="text-sm text-slate-500">
            أعلى {number(Math.min(10, data.contractors.length))} من{' '}
            {number(data.contractors.length)} مقاولًا
          </span>
        </div>
        <div className="space-y-5">
          {data.contractors.slice(0, 10).map((c, i) => (
            <div key={c.id}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700">
                    {number(i + 1)}
                  </span>
                  <span className="font-semibold">{c.name}</span>
                </span>
                <strong className="shrink-0 text-xl text-blue-700">{number(c.pending)}</strong>
              </div>
              <div
                className="h-3 overflow-hidden rounded-full bg-slate-100"
                role="img"
                aria-label={`${c.name}: ${c.pending} معلّق`}
              >
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${(100 * c.pending) / max}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {number(c.over180)} منها مضى عليها أكثر من 180 يومًا
              </p>
            </div>
          ))}
        </div>
        {!data.contractors.length && <p>لا توجد بلاغات معلقة مسندة حاليًا.</p>}
      </section>
      <section className="card surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <h3 className="text-xl font-bold">المشاريع وما لديها من بلاغات</h3>
          <label className="text-sm print:hidden">
            البحث في المشاريع
            <input
              className="form-control field mt-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="المشروع أو المقاول"
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="table report-table">
            <thead>
              <tr>
                {['المشروع', 'المقاول', 'إجمالي البلاغات', 'مغلق', 'معلّق'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.projects
                .filter((p) => (p.name + ' ' + p.contractor_name).includes(search.trim()))
                .map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.name}
                      <small className="block text-slate-500">{p.operational_number}</small>
                    </td>
                    <td>{p.contractor_name}</td>
                    <td>{number(p.total)}</td>
                    <td className="text-emerald-700">{number(p.total - p.pending)}</td>
                    <td className="font-bold text-amber-700">{number(p.pending)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
