'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Download, Search, ArrowRight, ArrowLeft } from 'lucide-react';
import type { ManagerSummary, StatusCount } from '@/lib/domain/manager';

const SpatialMap = dynamic(() => import('./SpatialMap'), { ssr: false });

type Row = {
  id: string;
  source_reference: string;
  reported_contractor_name: string | null;
  source_status: string;
  is_closed: number;
  age_days: number | null;
  classification: string;
  district_raw: string | null;
};

type Stats = {
  total: number;
  closed: number;
  statuses: StatusCount[];
  last_batch: { created_at: string } | null;
};

const initial = {
  search: '',
  classification: '',
  date_from: '',
  date_to: '',
  district: '',
  open: '',
};

export default function ViolationExplorer({
  mode = 'dashboard',
}: {
  mode?: 'dashboard' | 'list' | 'map';
}) {
  const [filters, setFilters] = useState(initial);
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);

  const query = useMemo(
    () => new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString(),
    [filters],
  );

  useEffect(() => {
    setBusy(true);
    Promise.all([
      fetch(`/api/violations?${query}&page=${page}&limit=25`).then((r) => r.json()),
      fetch(`/api/dashboard/stats?${query}`).then((r) => r.json()),
    ])
      .then(([list, summary]) => {
        setRows(list.data);
        setTotal(list.pagination.total);
        setStats(summary.data);
        setBusy(false);
      })
      .catch(() => setBusy(false));
  }, [query, page]);

  const cards = stats
    ? [
        { label: 'إجمالي البلاغات', value: stats.total, color: 'text-blue-600' },
        { label: 'تمت المعالجة', value: stats.closed, color: 'text-emerald-600' },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* العنوان */}
      <div className="card-glass flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">لوحة المتابعة</h2>
          <p className="mt-1 text-sm text-slate-600">
            {stats?.last_batch
              ? `آخر تحديث: ${new Date(stats.last_batch.created_at).toLocaleString('ar-SA')}`
              : 'متابعة التعديات والمشاريع'}
          </p>
        </div>
        <a
          href={`/api/reports/export/excel?${query}`}
          className="btn-secondary flex items-center gap-2"
        >
          <Download size={18} />
          تصدير
        </a>
      </div>

      {/* بطاقات الإحصائيات */}
      {mode === 'dashboard' && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.map(({ label, value, color }) => (
            <div key={label} className="stat-card">
              <p className="stat-label">{label}</p>
              <p className={`stat-value ${color}`}>{value.toLocaleString('ar-SA')}</p>
            </div>
          ))}
        </div>
      )}

      {/* نموذج الفلترة */}
      <div className="card-glass">
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
          }}
        >
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">البحث</label>
            <input
              className="input-field"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="رقم البلاغ أو المقاول"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">من تاريخ</label>
            <input
              type="date"
              className="input-field"
              value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">إلى تاريخ</label>
            <input
              type="date"
              className="input-field"
              value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <Search size={18} />
              بحث
            </button>
            <button type="button" onClick={() => setFilters(initial)} className="btn-secondary">
              مسح
            </button>
          </div>
        </form>
      </div>

      {/* الخريطة */}
      {mode !== 'list' && (
        <div className="map-container">
          <SpatialMap query={query} onSelect={() => {}} />
        </div>
      )}

      {/* الجدول */}
      <div className="card-glass overflow-hidden">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">
            النتائج ({total.toLocaleString('ar-SA')})
          </h3>
          {busy && <span className="text-sm text-blue-600">جارٍ التحميل...</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>رقم البلاغ</th>
                <th>الحي</th>
                <th>المقاول</th>
                <th>الحالة</th>
                <th>العمر</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="font-semibold text-blue-600">{row.source_reference}</td>
                  <td>{row.district_raw || 'غير محدد'}</td>
                  <td>{row.reported_contractor_name || 'غير محدد'}</td>
                  <td>{row.source_status}</td>
                  <td>{row.is_closed ? 'مغلق' : `${row.age_days || 0} يوم`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!busy && rows.length === 0 && (
          <p className="py-8 text-center text-slate-500">لا توجد نتائج</p>
        )}
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page <= 1}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowRight size={16} />
            السابق
          </button>
          <span className="text-sm text-slate-600">صفحة {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * 25 >= total}
            className="btn-secondary flex items-center gap-2"
          >
            التالي
            <ArrowLeft size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
