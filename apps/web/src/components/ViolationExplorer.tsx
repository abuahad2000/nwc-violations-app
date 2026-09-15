'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';
import {
  Download,
  Search,
  ArrowRight,
  ArrowLeft,
  MapPin,
  Filter,
  X,
  FileText,
  Clock,
  Briefcase,
  CheckCircle2,
} from 'lucide-react';
import AppShell from './AppShell';
import TaskPanel from './TaskPanel';
import ManagerCharts from './ManagerCharts';
import type { ManagerSummary, StatusCount } from '@/lib/domain/manager';
import { Sheet } from './ui/sheet';

const SpatialMap = dynamic(() => import('./SpatialMap'), {
  ssr: false,
  loading: () => (
    <div className="surface rounded-2xl p-12 flex flex-col items-center justify-center text-slate-500">
      <Clock className="h-8 w-8 mb-3 animate-pulse text-blue-500" />
      <p>جارٍ تحميل الخريطة التشغيلية…</p>
    </div>
  ),
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
  date_from: '',
  date_to: '',
  district: '',
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
  const [pageSize, setPageSize] = useState(25);
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const [contractors, setContractors] = useState<{ id: string; name: string }[]>([]);

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
    if (draft.search === filters.search) return;
    const timer = window.setTimeout(() => {
      setFilters((current) => ({ ...current, search: draft.search }));
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draft.search, filters.search]);

  useEffect(() => {
    fetch('/api/contractors')
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        setContractors(data.contractors || data.data || []);
      })
      .catch(() => undefined);
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
      get(`/api/violations?${query}&page=${page}&limit=${pageSize}`),
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
  }, [query, page, pageSize]);

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
          className="font-bold text-blue-700 hover:text-blue-900 underline-offset-4 hover:underline transition-colors flex items-center gap-1"
          onClick={() => details(c.row.original.id)}
        >
          <FileText size={14} />
          <bdi>{String(c.getValue())}</bdi>
        </button>
      ),
    },
    {
      accessorKey: 'district_raw',
      header: 'الحي',
      cell: (c) => <span className="text-slate-700">{String(c.getValue() || 'غير محدد')}</span>,
    },
    {
      accessorKey: 'reported_contractor_name',
      header: 'المقاول',
      cell: (c) => <span className="text-slate-700">{String(c.getValue() || 'غير محدد')}</span>,
    },
    {
      accessorKey: 'classification',
      header: 'التصنيف',
      cell: (c) => {
        const val = String(c.getValue());
        const isReview = val === 'UNDER_REVIEW';
        return (
          <span
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold border ${
              isReview
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            {isReview ? <Clock size={12} /> : <CheckCircle2 size={12} />}
            {labels[val] || 'مراجعة'}
          </span>
        );
      },
    },
    {
      accessorKey: 'source_status',
      header: 'الحالة الأصلية',
      cell: (c) => <span className="text-slate-600 text-sm">{String(c.getValue())}</span>,
    },
    {
      accessorKey: 'age_days',
      header: 'عمر المفتوح',
      cell: (c) => {
        if (c.row.original.is_closed) return <span className="text-slate-400 text-sm">مغلق</span>;
        if (c.getValue() == null) return <span className="text-slate-400 text-sm">غير معلوم</span>;
        return (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded-md">
            <Clock size={12} />
            {c.getValue()} يوم
          </span>
        );
      },
    },
  ];

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  const contractorCount =
    stats?.statuses.find((item) => item.status === 'تحت معالجة المقاول')?.count || 0;
  const entityCount =
    stats?.statuses.find((item) => item.status === 'تحت معالجة الجهة المتعدية')?.count || 0;

  const cards = stats
    ? ([
        [
          'إجمالي البلاغات',
          stats.total,
          { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
        ],
        [
          'تحت معالجة المقاول',
          contractorCount,
          { icon: Briefcase, color: 'text-amber-600', bg: 'bg-amber-50' },
        ],
        [
          'تحت معالجة الجهة',
          entityCount,
          { icon: Briefcase, color: 'text-purple-600', bg: 'bg-purple-50' },
        ],
        [
          'تمت المعالجة',
          stats.closed,
          { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ],
      ] as const)
    : [];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* === Hero Section === */}
        <div className="dashboard-hero flex flex-wrap items-center justify-between gap-4 p-6 rounded-2xl">
          <div>
            <p className="mb-1 text-sm font-medium text-blue-100/80 flex items-center gap-2">
              <MapPin size={14} />
              مساحة العمل / {mode === 'map' ? 'الخريطة التشغيلية' : 'لوحة المتابعة'}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {mode === 'dashboard'
                ? 'لوحة متابعة التعديات'
                : mode === 'map'
                  ? 'الخريطة التشغيلية'
                  : 'سجل التعديات'}
            </h2>
            <p className="mt-2 text-sm text-blue-100/70">
              {stats?.last_batch
                ? `آخر تحديث للبيانات: ${new Date(stats.last_batch.created_at).toLocaleString('ar-SA')}`
                : 'متابعة الحالة والموقع والإجراء بشكل فوري'}
            </p>
          </div>
          <a
            className="secondary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/20"
            href={`/api/reports/export/excel?${query}`}
          >
            <Download size={18} />
            تصدير النتائج
          </a>
        </div>

        {/* === Error Alert === */}
        {error && (
          <div
            className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-center gap-3"
            role="alert"
          >
            <X size={20} className="shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* === Stats Cards === */}
        {mode === 'dashboard' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {cards.map(([label, value, meta]) => (
              <button
                key={label}
                className="metric-card surface relative overflow-hidden p-5 text-start group"
                onClick={() =>
                  apply({
                    ...filters,
                    classification: '',
                    aging: '',
                    open: '',
                    source_status: label === 'إجمالي البلاغات' ? '' : label,
                  })
                }
              >
                <div
                  className={`absolute top-4 left-4 p-2 rounded-lg ${meta.bg} ${meta.color} opacity-80 group-hover:opacity-100 transition-opacity`}
                >
                  <meta.icon size={20} />
                </div>
                <span className="text-sm font-medium text-slate-500 block mb-2">{label}</span>
                <strong className="text-3xl font-bold text-slate-800 tabular-nums tracking-tight">
                  {value.toLocaleString('ar-SA')}
                </strong>
              </button>
            ))}
          </div>
        )}

        {/* === Filter Form === */}
        <form
          className="surface p-6 rounded-2xl grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            apply(draft);
          }}
        >
          <div className="xl:col-span-2">
            <label className="label flex items-center gap-2">
              <Search size={14} /> البحث السريع
            </label>
            <input
              className="field w-full"
              value={draft.search}
              onChange={(e) => setDraft({ ...draft, search: e.target.value })}
              placeholder="رقم البلاغ، المقاول، الحي أو المشروع..."
            />
          </div>

          <div>
            <label className="label">التصنيف المكاني</label>
            <select
              className="field w-full"
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
          </div>

          <div>
            <label className="label">حالة السجل</label>
            <select
              className="field w-full"
              value={draft.open}
              onChange={(e) => setDraft({ ...draft, open: e.target.value })}
            >
              <option value="">الكل</option>
              <option value="1">مفتوح</option>
              <option value="0">مغلق</option>
            </select>
          </div>

          <div>
            <label className="label">من تاريخ</label>
            <input
              type="date"
              className="field w-full"
              value={draft.date_from}
              onChange={(e) => setDraft({ ...draft, date_from: e.target.value })}
            />
          </div>

          <div>
            <label className="label">إلى تاريخ</label>
            <input
              type="date"
              className="field w-full"
              value={draft.date_to}
              onChange={(e) => setDraft({ ...draft, date_to: e.target.value })}
            />
          </div>

          <div>
            <label className="label">الحي / المنطقة</label>
            <input
              className="field w-full"
              value={draft.district}
              onChange={(e) => setDraft({ ...draft, district: e.target.value })}
              placeholder="اكتب اسم الحي"
            />
          </div>

          <div>
            <label className="label">المقاول</label>
            <select
              className="field w-full"
              value={draft.reported_contractor}
              onChange={(e) => setDraft({ ...draft, reported_contractor: e.target.value })}
            >
              <option value="">كل المقاولين</option>
              {contractors.map((contractor) => (
                <option key={contractor.id} value={contractor.id}>
                  {contractor.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 xl:col-span-4 flex flex-wrap items-end gap-3 pt-2 border-t border-slate-100 mt-2">
            <button className="primary flex items-center gap-2" disabled={busy}>
              <Search size={18} />
              تطبيق الفلاتر
            </button>
            <button
              type="button"
              className="secondary flex items-center gap-2"
              onClick={() => apply(initial)}
            >
              <X size={18} />
              مسح الكل
            </button>
            <div className="mr-auto flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
              <span>عدد الصفوف:</span>
              <select
                className="bg-transparent font-semibold outline-none cursor-pointer"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </form>

        {/* === Active Filters Chips === */}
        {(filters.executive ||
          filters.program_manager ||
          filters.manager ||
          filters.source_status) && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-sm text-blue-900 backdrop-blur-sm">
            <Filter size={16} className="shrink-0" />
            <span className="font-medium">تصفية نشطة:</span>
            <span className="opacity-80">
              {filters.executive} {filters.program_manager}{' '}
              {filters.manager === '__unassigned__' ? 'بلا مدير مرتبط' : filters.manager}{' '}
              {filters.source_status}
            </span>
            <button
              className="secondary ms-auto text-xs px-2 py-1 h-auto"
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
              إزالة التصفية
            </button>
          </div>
        )}

        {/* === Charts & Map === */}
        {mode === 'dashboard' && stats && (
          <div className="surface p-6 rounded-2xl">
            <ManagerCharts
              statuses={stats.statuses}
              total={stats.total}
              closed={stats.closed}
              onStatus={(source_status) => apply({ ...filters, source_status })}
            />
          </div>
        )}

        {mode !== 'list' && (
          <div className="surface rounded-2xl overflow-hidden border border-slate-200">
            <SpatialMap query={query} onSelect={details} />
          </div>
        )}

        {/* === Data Table === */}
        <section className="surface rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-5 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-blue-600" />
              <h3 className="font-bold text-slate-800">سجل التعديات</h3>
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full">
                {total.toLocaleString('ar-SA')}
              </span>
            </div>
            {busy && (
              <span
                role="status"
                className="flex items-center gap-2 text-sm text-blue-600 font-medium"
              >
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                جارٍ التحديث…
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="report-table w-full text-start text-sm">
              <thead>
                {table.getHeaderGroups().map((h) => (
                  <tr key={h.id}>
                    {h.headers.map((c) => (
                      <th
                        key={c.id}
                        className="font-semibold text-slate-600 uppercase tracking-wider text-xs"
                      >
                        {flexRender(c.column.columnDef.header, c.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((r, index) => (
                  <tr
                    key={r.id}
                    className={`group transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/60`}
                  >
                    {r.getVisibleCells().map((c) => (
                      <td key={c.id} className="px-5 py-4 align-middle">
                        {flexRender(c.column.columnDef.cell, c.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!busy && !rows.length && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Search size={48} className="mb-4 text-slate-300" />
              <p className="text-lg font-medium">لا توجد نتائج مطابقة للفلاتر المحددة</p>
              <button className="secondary mt-4" onClick={() => apply(initial)}>
                مسح الفلاتر
              </button>
            </div>
          )}

          {rows.length > 0 && (
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 p-4 bg-slate-50/50">
              <button
                className="secondary flex items-center gap-2"
                disabled={page <= 1 || busy}
                onClick={() => setPage((p) => p - 1)}
              >
                <ArrowRight size={16} />
                السابق
              </button>
              <span className="text-sm font-medium text-slate-600 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
                صفحة {page} من {Math.max(1, Math.ceil(total / pageSize))}
              </span>
              <button
                className="secondary flex items-center gap-2"
                disabled={page * pageSize >= total || busy}
                onClick={() => setPage((p) => p + 1)}
              >
                التالي
                <ArrowLeft size={16} />
              </button>
            </div>
          )}
        </section>

        {/* === Details Sheet === */}
        <Sheet
          open={!!selected}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          title={`تفاصيل البلاغ ${selected?.source_reference || ''}`}
        >
          {selected && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-slate-700 leading-relaxed">
                  {selected.description_raw || 'لا يوجد وصف متاح لهذا البلاغ.'}
                </p>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                {[
                  ['الحالة الأصلية', selected.source_status],
                  ['المقاول في المصدر', selected.reported_contractor_name],
                  ['المشروع المرتبط', selected.project_name],
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
                  <div key={key} className="border-b border-slate-100 pb-3 last:border-0">
                    <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      {key}
                    </dt>
                    <dd className="text-sm font-medium text-slate-800">{value || 'غير محدد'}</dd>
                  </div>
                ))}
              </dl>

              <div className="pt-4 border-t border-slate-200">
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
            </div>
          )}
        </Sheet>
      </div>
    </AppShell>
  );
}
