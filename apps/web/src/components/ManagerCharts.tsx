'use client';
import { useState } from 'react';
import { BarChart3, Users, ArrowUpLeft } from 'lucide-react';
import type { ManagerSummary, StatusCount } from '@/lib/domain/manager';

type Props = {
  managers: ManagerSummary[];
  statuses: StatusCount[];
  unassigned: number;
  total: number;
  closed: number;
  onManager: (key: string) => void;
  onStatus: (status: string) => void;
};
const number = (n: number) => n.toLocaleString('ar-SA');
const segments = [
  ['contractor', 'لدى المقاول', 'bg-teal-600'],
  ['processing', 'معالجة جهة أخرى', 'bg-sky-500'],
  ['other', 'حالات مفتوحة أخرى', 'bg-amber-400'],
  ['closed', 'تمت المعالجة', 'bg-slate-300'],
] as const;

export default function ManagerCharts({
  managers,
  statuses,
  unassigned,
  total,
  closed,
  onManager,
  onStatus,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = managers.filter((m) => m.name.includes(search));
  const visible = showAll ? filtered : filtered.slice(0, 8);
  const progress = total ? Math.round((closed / total) * 100) : 0;
  const max = Math.max(1, ...statuses.map((s) => s.count));
  return (
    <div className="space-y-6" data-testid="manager-charts">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section className="surface p-6">
          <p className="text-xs font-semibold tracking-wide text-teal-700">نظرة على الإنجاز</p>
          <h3 className="mt-2 text-lg font-bold">حالة معالجة التعديات</h3>
          <div
            className="mx-auto my-6 grid h-44 w-44 place-items-center rounded-full"
            role="img"
            aria-label={`نسبة المعالجة ${progress}%، ${closed} من ${total}`}
            style={{ background: `conic-gradient(#0e7c86 ${progress}%,#eaf0f5 0)` }}
          >
            <div className="grid h-36 w-36 content-center rounded-full bg-white text-center">
              <strong className="text-4xl font-bold tabular-nums">{number(progress)}٪</strong>
              <span className="mt-1 text-sm text-slate-500">تمت المعالجة</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-center">
            <div>
              <span className="text-sm text-slate-500">مغلق</span>
              <strong className="mt-1 block text-xl">{number(closed)}</strong>
            </div>
            <div>
              <span className="text-sm text-slate-500">قيد المتابعة</span>
              <strong className="mt-1 block text-xl">{number(total - closed)}</strong>
            </div>
          </div>
        </section>
        <section className="surface p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="rounded-xl bg-teal-50 p-3 text-teal-700">
              <BarChart3 size={22} />
            </span>
            <div>
              <h3 className="text-lg font-bold">التعديات بحسب حالة المصدر</h3>
              <p className="mt-1 text-xs text-slate-500">
                التصنيفات كما وردت في ملف التعديات · اضغط لتصفية النتائج
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {statuses.map((s) => (
              <button
                key={s.status}
                onClick={() => onStatus(s.status)}
                className="group grid w-full grid-cols-[minmax(0,1fr)_3rem] gap-x-3 rounded-lg px-2 py-1.5 text-start hover:bg-slate-50"
                aria-label={`${s.status}: ${number(s.count)} بلاغ`}
              >
                <span className="text-xs font-medium sm:text-sm">{s.status || 'غير محدد'}</span>
                <strong className="text-end text-sm tabular-nums">{number(s.count)}</strong>
                <span className="col-span-2 mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className={`block h-full rounded-full ${s.status === 'تمت المعالجة' ? 'bg-slate-400' : s.status === 'تحت معالجة المقاول' ? 'bg-teal-600' : 'bg-sky-500'}`}
                    style={{ width: `${(s.count / max) * 100}%` }}
                  />
                </span>
              </button>
            ))}
            {!statuses.length && (
              <p className="py-8 text-center text-sm text-slate-500">
                لا توجد حالات ضمن الفلاتر الحالية.
              </p>
            )}
          </div>
        </section>
      </div>
      <section className="surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-6">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-slate-100 p-3">
              <Users size={22} />
            </span>
            <div>
              <h3 className="text-lg font-bold">متابعة مديري المشاريع</h3>
              <p className="mt-1 text-xs text-slate-500">
                المعالجة تشمل ما لدى المقاول · الحالات من ملف التعديات
              </p>
            </div>
          </div>
          <label className="w-full sm:w-56">
            <span className="sr-only">البحث عن مدير مشروع</span>
            <input
              className="field"
              placeholder="ابحث باسم مدير المشروع"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 px-6 pt-5 text-xs text-slate-600">
          {segments.map(([key, label, color]) => (
            <span key={key} className="flex items-center gap-2">
              <i className={`h-2.5 w-2.5 rounded-full ${color}`} />
              {label}
            </span>
          ))}
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-2">
          {visible.map((m) => (
            <article
              key={m.key}
              className="rounded-2xl border border-slate-200 p-4 transition hover:border-teal-300 hover:shadow-sm"
            >
              <button
                onClick={() => onManager(m.key)}
                className="flex w-full items-center justify-between gap-2 text-start"
                aria-label={`عرض تعديات ${m.name}`}
              >
                <h4 className="text-sm font-bold">{m.name}</h4>
                <ArrowUpLeft size={17} className="shrink-0 text-slate-400" />
              </button>
              <div className="my-4 grid grid-cols-3 divide-x divide-x-reverse divide-slate-100 text-center">
                <div>
                  <strong className="text-xl font-bold">{number(m.total)}</strong>
                  <p className="mt-1 text-xs text-slate-500">إجمالي التعديات</p>
                </div>
                <div>
                  <strong className="text-xl font-bold text-sky-700">{number(m.processing)}</strong>
                  <p className="mt-1 text-xs text-slate-500">تحت المعالجة</p>
                </div>
                <div>
                  <strong className="text-xl font-bold text-teal-700">
                    {number(m.contractor)}
                  </strong>
                  <p className="mt-1 text-xs text-slate-500">منها لدى المقاول</p>
                </div>
              </div>
              <div
                className="flex h-2.5 overflow-hidden rounded-full bg-slate-100"
                role="img"
                aria-label={`لدى المقاول ${m.contractor}، معالجة جهة أخرى ${m.processing - m.contractor}، حالات مفتوحة أخرى ${m.other}، مغلق ${m.closed}`}
              >
                {segments.map(([key, , color]) => (
                  <span
                    key={key}
                    className={color}
                    style={{
                      width: `${((key === 'processing' ? m.processing - m.contractor : m[key]) / Math.max(1, m.total)) * 100}%`,
                    }}
                  />
                ))}
              </div>
              {!m.total && (
                <p className="mt-3 text-xs text-slate-500">
                  لا توجد سجلات مرتبطة بهذا المدير ضمن الفلاتر الحالية.
                </p>
              )}
            </article>
          ))}
        </div>
        {!filtered.length && <p className="p-6 text-center text-slate-500">لا يوجد مدير مطابق.</p>}
        {filtered.length > 8 && (
          <div className="px-6 pb-5">
            <button className="secondary w-full" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'عرض أقل' : `عرض جميع المديرين (${number(filtered.length)})`}
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-100 bg-amber-50/60 px-6 py-4">
          <p className="max-w-2xl text-xs leading-6 text-amber-900">
            {number(unassigned)} سجلًا بلا مدير مشروع مرتبط ضمن النتائج. الربط يعتمد على المشروع
            المكاني المعتمد؛ لا يُنسب البلاغ لمدير من اسم المقاول وحده.
          </p>
          <button className="secondary" onClick={() => onManager('__unassigned__')}>
            عرض غير المرتبط
          </button>
        </div>
      </section>
    </div>
  );
}
