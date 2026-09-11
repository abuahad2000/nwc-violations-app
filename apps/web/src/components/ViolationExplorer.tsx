'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';
import { Download, Search, ArrowRight, ArrowLeft, MapPin } from 'lucide-react';
import AppShell from './AppShell';
import TaskPanel from './TaskPanel';
import ManagerCharts from './ManagerCharts';
import ProgramDashboardChart from './ProgramDashboardChart';
import type { ManagerSummary, StatusCount } from '@/lib/domain/manager';
import { Sheet } from './ui/sheet';
const SpatialMap = dynamic(() => import('./SpatialMap'), {
  ssr: false,
  loading: () => <p className="p-6">جارٍ تحميل الخريطة…</p>,
});
type Row = {
  updated_at: string;
  id: string;
  source_reference: string;
  reported_contractor_name: string | null;
  project_contractor_name: string | null;
  project_name: string | null;
  source_status: string;
  is_closed: number;
  age_days: number | null;
  classification: string;
  classification_reason: string;
  description_raw: string | null;
  district_raw: string | null;
  project_manager_name?: string;
  current_action_owner_id?: string;
};
type Stats = {
  managers: ManagerSummary[];
  statuses: StatusCount[];
  unassigned_manager: number;
  total: number;
  open: number;
  closed: number;
  inside_project: number;
  outside_project: number;
  under_review: number;
  age_181_plus: number;
  last_batch: { created_at: string } | null;
};
const labels: Record<string, string> = {
  INSIDE_PROJECT_BOUNDARY: 'داخل المشروع',
  OUTSIDE_PROJECT_BOUNDARY: 'خارج المشروع · الصيانة',
  UNDER_REVIEW: 'تحتاج مراجعة',
};
const initial = {
  executive: '',
  program_manager: '',
  manager: '',
  source_status: '',
  search: '',
  classification: '',
  aging: '',
  open: '',
  project_id: '',
  reported_contractor: '',
  project_contractor: '',
  action_owner: '',
};
export default function ViolationExplorer({
  mode = 'dashboard',
}: {
  mode?: 'dashboard' | 'list' | 'map';
}) {
  const [filters, setFilters] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const query = useMemo(
    () => new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString(),
    [filters],
  );
  useEffect(() => {
    const url = new URL(window.location.href);
    const f = { ...initial };
    for (const key of Object.keys(f) as (keyof typeof f)[])
      f[key] = url.searchParams.get(key) || '';
    setFilters(f);
    setDraft(f);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError('');
    const get = async (url: string) => {
      const r = await fetch(url, { signal: controller.signal });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || 'تعذر جلب البيانات');
      return d;
    };
    Promise.all([
      get(`/api/violations?${query}&page=${page}&limit=25`),
      get(`/api/dashboard/stats?${query}`),
    ])
      .then(([list, summary]) => {
        setRows(list.data);
        setTotal(list.pagination.total);
        setStats(summary.data);
        setBusy(false);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setError(e.message);
          setBusy(false);
        }
      });
    return () => controller.abort();
  }, [query, page]);
  const apply = (f: typeof initial) => {
    setDraft(f);
    setFilters(f);
    setPage(1);
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}?${new URLSearchParams(Object.entries(f).filter(([, v]) => v))}`,
    );
  };
  const details = async (id: string) => {
    try {
      const r = await fetch(`/api/violations/${encodeURIComponent(id)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setSelected(d.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر عرض التفاصيل');
    }
  };
  const columns: ColumnDef<Row>[] = [
    {
      accessorKey: 'source_reference',
      header: 'رقم البلاغ',
      cell: (c) => (
        <button
          className="font-semibold text-teal-800 underline-offset-4 hover:underline"
          onClick={() => details(c.row.original.id)}
        >
          <bdi>{String(c.getValue())}</bdi>
        </button>
      ),
    },
    {
      accessorKey: 'district_raw',
      header: 'الحي',
      cell: (c) => String(c.getValue() || 'غير محدد'),
    },
    {
      accessorKey: 'reported_contractor_name',
      header: 'المقاول في المصدر',
      cell: (c) => String(c.getValue() || 'غير محدد'),
    },
    {
      accessorKey: 'classification',
      header: 'التصنيف',
      cell: (c) => (
        <span
          className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${c.getValue() === 'UNDER_REVIEW' ? 'bg-amber-50 text-amber-800' : 'bg-teal-50 text-teal-800'}`}
        >
          {labels[String(c.getValue())] || 'مراجعة'}
        </span>
      ),
    },
    { accessorKey: 'source_status', header: 'الحالة الأصلية' },
    {
      accessorKey: 'age_days',
      header: 'عمر المفتوح',
      cell: (c) =>
        c.row.original.is_closed
          ? 'مغلق'
          : c.getValue() == null
            ? 'غير معلوم'
            : `${c.getValue()} يوم`,
    },
  ];
  // eslint-disable-next-line react-hooks/incompatible-library -- React Compiler is not enabled; table objects stay inside this component.
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });
  const cards = stats
    ? ([
        ['إجمالي التعديات', stats.total, {}],
        ['داخل المشاريع', stats.inside_project, { classification: 'INSIDE_PROJECT_BOUNDARY' }],
        ['خارج المشاريع', stats.outside_project, { classification: 'OUTSIDE_PROJECT_BOUNDARY' }],
        ['تحتاج مراجعة', stats.under_review, { classification: 'UNDER_REVIEW' }],
        ['تمت المعالجة / مغلق', stats.closed, { open: '0' }],
        ['مفتوح أكثر من 180 يومًا', stats.age_181_plus, { aging: '181+' }],
      ] as const)
    : [];
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="dashboard-hero flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-sm text-teal-200">
              مساحة العمل / {mode === 'map' ? 'الخريطة' : 'التعديات'}
            </p>
            <h2 className="text-2xl font-bold">
              {mode === 'dashboard'
                ? 'لوحة المتابعة'
                : mode === 'map'
                  ? 'الخريطة التشغيلية'
                  : 'سجل التعديات'}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {stats?.last_batch
                ? `آخر دفعة: ${new Date(stats.last_batch.created_at).toLocaleString('ar-SA')}`
                : 'متابعة الحالة والموقع والإجراء'}
            </p>
          </div>
          <a className="btn secondary" href={`/api/reports/export/excel?${query}`}>
            <Download size={18} />
            تصدير النتائج
          </a>
        </div>
        {error && (
          <p role="alert" className="notice-error">
            {error}
          </p>
        )}
        {mode === 'dashboard' && (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {cards.map(([label, value, filter]) => (
              <button
                key={label}
                className="metric-card surface relative overflow-hidden p-5 text-start transition hover:-translate-y-0.5 hover:border-teal-500 hover:shadow-md"
                onClick={() =>
                  apply({ ...filters, classification: '', aging: '', open: '', ...filter })
                }
              >
                <span className="text-sm text-slate-500">{label}</span>
                <strong className="mt-3 block text-3xl tabular-nums">
                  {value.toLocaleString('ar-SA')}
                </strong>
              </button>
            ))}
          </div>
        )}
        <form
          className="card surface grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            apply(draft);
          }}
        >
          <label className="xl:col-span-2">
            <span className="label">البحث</span>
            <input
              className="form-control field"
              value={draft.search}
              onChange={(e) => setDraft({ ...draft, search: e.target.value })}
              placeholder="رقم البلاغ، المقاول، الحي أو المشروع"
            />
          </label>
          <label>
            <span className="label">التصنيف المكاني</span>
            <select
              className="form-control field"
              value={draft.classification}
              onChange={(e) => setDraft({ ...draft, classification: e.target.value })}
            >
              <option value="">كل التصنيفات</option>
              {Object.entries(labels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">حالة السجل</span>
            <select
              className="form-control field"
              value={draft.open}
              onChange={(e) => setDraft({ ...draft, open: e.target.value })}
            >
              <option value="">الكل</option>
              <option value="1">مفتوح</option>
              <option value="0">مغلق</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button className="btn btn-primary primary" disabled={busy}>
              <Search size={18} />
              تطبيق
            </button>
            <button type="button" className="btn secondary" onClick={() => apply(initial)}>
              مسح
            </button>
          </div>
        </form>
        {filters.aging && (
          <p className="text-sm">
            فلتر عمر المفتوح: <bdi>{filters.aging}</bdi> يوم{' '}
            <button className="btn secondary ms-2" onClick={() => apply({ ...filters, aging: '' })}>
              إزالة
            </button>
          </p>
        )}
        {(filters.executive ||
          filters.program_manager ||
          filters.manager ||
          filters.source_status) && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-teal-100 bg-teal-50 p-3 text-sm text-teal-900">
            <span>
              تصفية الشارت: {filters.executive} {filters.program_manager}{' '}
              {filters.manager === '__unassigned__' ? 'بلا مدير مرتبط' : filters.manager}{' '}
              {filters.source_status}
            </span>
            <button
              className="btn secondary"
              onClick={() =>
                apply({
                  ...filters,
                  executive: '',
                  program_manager: '',
                  manager: '',
                  source_status: '',
                })
              }
            >
              إزالة تصفية الشارت
            </button>
          </div>
        )}
        <p className="text-sm text-slate-500">
          المؤشرات والجدول والخريطة والتصدير تتبع الفلاتر الحالية. العمر ليس مهلة إجرائية معتمدة.
        </p>
        {mode === 'dashboard' && stats && (
          <ManagerCharts
            managers={stats.managers}
            statuses={stats.statuses}
            unassigned={stats.unassigned_manager}
            total={stats.total}
            closed={stats.closed}
            onManager={(manager) => apply({ ...filters, manager })}
            onStatus={(source_status) => apply({ ...filters, source_status })}
          />
        )}
        {mode === 'dashboard' && (
          <ProgramDashboardChart
            query={query}
            onSelect={(program_manager, manager, executive) =>
              apply({ ...filters, program_manager, manager, executive })
            }
          />
        )}
        {mode !== 'list' && <SpatialMap query={query} onSelect={details} />}
        <section className="card surface min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 p-4">
            <MapPin size={18} />
            <h3 className="font-semibold">النتائج ({total.toLocaleString('ar-SA')})</h3>
            {busy && (
              <span role="status" className="ms-auto text-sm text-teal-700">
                جارٍ التحديث…
              </span>
            )}
          </div>
          <div className="max-w-full overflow-x-auto">
            <table className="table table-vcenter w-full min-w-[760px] text-start text-sm">
              <thead className="bg-slate-50 text-slate-500">
                {table.getHeaderGroups().map((h) => (
                  <tr key={h.id}>
                    {h.headers.map((c) => (
                      <th key={c.id} className="p-4 text-start font-medium">
                        {flexRender(c.column.columnDef.header, c.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    {r.getVisibleCells().map((c) => (
                      <td key={c.id} className="max-w-64 px-4 py-4">
                        {flexRender(c.column.columnDef.cell, c.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!busy && !rows.length && (
            <p className="p-8 text-center text-slate-500">لا توجد نتائج مطابقة للفلاتر.</p>
          )}
          <div className="flex items-center justify-between gap-2 p-4">
            <button
              className="btn secondary"
              disabled={page <= 1 || busy}
              onClick={() => setPage((p) => p - 1)}
            >
              <ArrowRight size={18} />
              السابق
            </button>
            <span className="text-sm">
              {page} / {Math.max(1, Math.ceil(total / 25))}
            </span>
            <button
              className="btn secondary"
              disabled={page * 25 >= total || busy}
              onClick={() => setPage((p) => p + 1)}
            >
              التالي
              <ArrowLeft size={18} />
            </button>
          </div>
        </section>
        <Sheet
          open={!!selected}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          title={`تفاصيل البلاغ ${selected?.source_reference || ''}`}
        >
          {selected && (
            <div className="space-y-5">
              <p>{selected.description_raw || 'لا يوجد وصف'}</p>
              <dl className="grid gap-4">
                {[
                  ['الحالة الأصلية', selected.source_status],
                  ['المقاول في المصدر', selected.reported_contractor_name],
                  ['المشروع', selected.project_name],
                  ['مقاول المشروع', selected.project_contractor_name],
                  ['مدير المشروع للمتابعة', selected.project_manager_name],
                  ['سبب التصنيف', selected.classification_reason],
                  [
                    'مسؤول الإجراء',
                    selected.current_action_owner_id
                      ? 'مسند؛ راجع سجل الإجراءات'
                      : 'يحتاج تحديد الجهة المسؤولة',
                  ],
                ].map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-sm text-slate-500">{key}</dt>
                    <dd className="mt-1 font-medium">{value || 'غير محدد'}</dd>
                  </div>
                ))}
              </dl>
              <TaskPanel
                id={selected.id}
                owner={selected.current_action_owner_id || null}
                updatedAt={selected.updated_at}
                isClosed={!!selected.is_closed}
                onSaved={() => {
                  void details(selected.id);
                  setFilters({ ...filters });
                }}
              />
            </div>
          )}
        </Sheet>
      </div>
    </AppShell>
  );
}
