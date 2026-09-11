'use client';
import { useEffect, useState } from 'react';
import type { ProgramDashboard, ProgramCounts } from '@/lib/domain/program-dashboard';
const n = (v: number) => v.toLocaleString('ar-SA');
function Counts({ counts }: { counts: ProgramCounts }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
      <span>
        إجمالي البلاغات <b>{n(counts.total)}</b>
      </span>
      <span className="text-amber-800">
        معلّق / مفتوح <b>{n(counts.pending)}</b>
      </span>
      <span className="text-teal-800">
        تحت معالجة المقاول <b>{n(counts.contractor)}</b>
      </span>
    </div>
  );
}
export default function ProgramDashboardChart({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (program: string, manager: string) => void;
}) {
  const [result, setResult] = useState<{
    query: string;
    data: ProgramDashboard | null;
    error?: string;
    denied?: boolean;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/reports/program-dashboard?${query}`, { signal: controller.signal })
      .then(async (r) => {
        if (r.status === 403) {
          setResult({ query, data: null, denied: true });
          return;
        }
        const data = await r.json();
        if (!r.ok) throw Error(data.message);
        setResult({ query, data });
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setResult({ query, data: null, error: e.message });
      });
    return () => controller.abort();
  }, [query]);
  if (result?.query !== query) return <p role="status">جارٍ تحميل تقرير مدراء البرامج…</p>;
  if (result.denied) return null;
  if (result.error)
    return (
      <p role="alert" className="notice-error">
        {result.error}
      </p>
    );
  if (!result.data) return null;
  const data = result.data,
    max = Math.max(1, ...data.programs.map((p) => p.pending));
  return (
    <section className="card surface overflow-hidden" aria-labelledby="program-dashboard-title">
      <header className="bg-[#182433] p-5 text-white">
        <p className="mb-2 text-sm text-cyan-200">المدير التنفيذي ← مدراء البرامج ← مدير المشروع</p>
        <h3 id="program-dashboard-title" className="text-2xl font-bold text-white">
          تقرير مدراء البرامج والبلاغات
        </h3>
        <p className="mt-2 text-slate-200">
          المدير التنفيذي{data.executive ? `: ${data.executive}` : ' · متابعة البرامج'}
        </p>
        <div className="mt-4 flex flex-wrap gap-6">
          <span>
            إجمالي بلاغات البرامج <b>{n(data.assigned.total)}</b>
          </span>
          <span>
            معلّق / مفتوح <b>{n(data.assigned.pending)}</b>
          </span>
          <span>
            تحت معالجة المقاول <b>{n(data.assigned.contractor)}</b>
          </span>
        </div>
      </header>
      <div className="space-y-5 p-5">
        <p className="text-sm text-slate-600">
          المعلّق والمفتوح يعنيان جميع البلاغات غير المغلقة؛ تحت معالجة المقاول جزء منها بحسب الحالة
          في ملف التعديات. الأعداد تتبع الفلاتر الحالية. افتح اسم مدير البرنامج لعرض مديري مشاريعه.
        </p>
        <div className="flex flex-wrap gap-5 text-sm">
          <span className="flex items-center gap-2">
            <i className="h-3 w-3 rounded bg-teal-600" />
            تحت معالجة المقاول
          </span>
          <span className="flex items-center gap-2">
            <i className="h-3 w-3 rounded bg-amber-400" />
            بقية البلاغات غير المغلقة
          </span>
        </div>
        <div className="max-h-[620px] space-y-3 overflow-y-auto pe-1">
          {data.programs.map((p) => (
            <details key={p.key} className="rounded-xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer space-y-3">
                <span className="font-bold text-slate-800">{p.name}</span>
                <Counts counts={p} />
                <span
                  role="img"
                  aria-label={`${p.name}: ${p.pending} معلّق، منها ${p.contractor} تحت معالجة المقاول`}
                  className="block h-4 overflow-hidden rounded-full bg-slate-100"
                >
                  <span className="flex h-full" style={{ width: `${(p.pending / max) * 100}%` }}>
                    <span
                      className="h-full bg-teal-600"
                      style={{ width: `${p.pending ? (p.contractor / p.pending) * 100 : 0}%` }}
                    />
                    <span className="h-full flex-1 bg-amber-400" />
                  </span>
                </span>
              </summary>
              <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                <button className="btn secondary" onClick={() => onSelect(p.key, '')}>
                  عرض بلاغات البرنامج على الخريطة
                </button>
                {p.managers.map((m) => (
                  <div key={m.key} className="rounded-lg bg-slate-50 p-3">
                    <p className="mb-2 font-semibold">مدير المشروع: {m.name}</p>
                    <Counts counts={m} />
                    {m.key && (
                      <button
                        className="mt-2 text-sm text-blue-700 underline"
                        onClick={() => onSelect(p.key, m.key)}
                      >
                        عرض البلاغات على الخريطة
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
        {!data.programs.length && <p>لا توجد برامج مطابقة للفلاتر.</p>}
        <aside className="rounded-xl bg-amber-50 p-4 text-amber-900">
          <p className="mb-2 font-semibold">بلاغات بلا مدير برنامج مرتبط — لم تُنسب إلى أي مدير</p>
          <Counts counts={data.unassigned} />
        </aside>
      </div>
    </section>
  );
}
