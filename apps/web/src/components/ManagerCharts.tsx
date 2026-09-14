'use client';
import { BarChart3 } from 'lucide-react';
import type { StatusCount } from '@/lib/domain/manager';

type Props = {
  statuses: StatusCount[];
  total: number;
  closed: number;
  onStatus: (status: string) => void;
};
const number = (n: number) => n.toLocaleString('ar-SA');

export default function ManagerCharts({
  statuses,
  total,
  closed,
  onStatus,
}: Props) {
  const progress = total ? Math.round((closed / total) * 100) : 0;
  const contractor = statuses.find((s) => s.status === 'تحت معالجة المقاول')?.count || 0;
  const entity = statuses.find((s) => s.status === 'تحت معالجة الجهة المتعدية')?.count || 0;
  const other = Math.max(0, total - closed - contractor - entity);
  const pct = (value: number) => total ? (value / total) * 100 : 0;
  const contractorEnd = pct(closed) + pct(contractor);
  const entityEnd = contractorEnd + pct(entity);
  const max = Math.max(1, ...statuses.map((s) => s.count));
  return (
    <div className="space-y-6" data-testid="manager-charts">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section className="card surface p-6">
          <p className="text-xs font-semibold tracking-wide text-teal-700">نظرة على الإنجاز</p>
          <h3 className="mt-2 text-lg font-bold">حالة معالجة التعديات</h3>
          <div
            className="mx-auto my-6 grid h-44 w-44 place-items-center rounded-full"
            role="img"
            aria-label={`نسبة المعالجة ${progress}%، ${closed} من ${total}`}
            style={{ background: `conic-gradient(#10b981 0 ${pct(closed)}%, #f59e0b ${pct(closed)}% ${contractorEnd}%, #3b82f6 ${contractorEnd}% ${entityEnd}%, #ef4444 ${entityEnd}% 100%)` }}
          >
            <div className="grid h-36 w-36 content-center rounded-full bg-white text-center">
              <strong className="text-4xl font-bold tabular-nums">{number(progress)}٪</strong>
              <span className="mt-1 text-sm text-slate-500">تمت المعالجة</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 text-xs text-slate-600"><span>🟢 تمت المعالجة: {number(closed)}</span><span>🟠 المقاول: {number(contractor)}</span><span>🔵 الجهة: {number(entity)}</span><span>🔴 أخرى: {number(other)}</span></div>
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
        <section className="card surface p-6">
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
    </div>
  );
}
