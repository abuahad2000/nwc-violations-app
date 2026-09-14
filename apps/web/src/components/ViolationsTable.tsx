'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, Pencil, Search } from 'lucide-react';

export type ViolationTableRow = {
  id: string;
  source_reference: string;
  contractor_name: string | null;
  district: string | null;
  source_status: string;
  classification: string;
  project_name: string | null;
};

type Column = { key: keyof ViolationTableRow; label: string };
const columns: Column[] = [
  { key: 'source_reference', label: 'رقم البلاغ' },
  { key: 'contractor_name', label: 'المقاول' },
  { key: 'district', label: 'الحي' },
  { key: 'source_status', label: 'الحالة' },
  { key: 'classification', label: 'التصنيف' },
  { key: 'project_name', label: 'المشروع' },
];

function statusTone(status: string): string {
  if (status.includes('تمت') || status.includes('معالج')) return 'bg-emerald-50 text-emerald-700';
  if (status.includes('مقاول')) return 'bg-amber-50 text-amber-700';
  return 'bg-rose-50 text-rose-700';
}

export default function ViolationsTable({ rows, onSelect }: { rows: ViolationTableRow[]; onSelect?: (row: ViolationTableRow) => void }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<{ key: keyof ViolationTableRow; direction: 'asc' | 'desc' }>({ key: 'source_reference', direction: 'asc' });
  const statuses = useMemo(() => [...new Set(rows.map((row) => row.source_status).filter(Boolean))], [rows]);
  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const visibleRows = useMemo(() => {
    const query = debouncedSearch.trim().toLocaleLowerCase('ar');
    return rows
      .filter((row) => !status || row.source_status === status)
      .filter((row) => !query || Object.values(row).some((value) => String(value ?? '').toLocaleLowerCase('ar').includes(query)))
      .sort((a, b) => {
        const left = String(a[sort.key] ?? '');
        const right = String(b[sort.key] ?? '');
        const result = left.localeCompare(right, 'ar', { numeric: true });
        return sort.direction === 'asc' ? result : -result;
      });
  }, [rows, debouncedSearch, status, sort]);
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const pagedRows = visibleRows.slice((page - 1) * pageSize, page * pageSize);
  const toggleSort = (key: keyof ViolationTableRow) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));

  return (
    <section dir="rtl" className="surface overflow-hidden rounded-2xl" aria-label="جدول البلاغات">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث برقم البلاغ أو المقاول أو الحي" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pe-10 ps-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" aria-label="البحث في البلاغات" />
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm" aria-label="فلترة الحالة">
          <option value="">كل الحالات</option>
          {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-slate-100/80 text-slate-600"><tr>{columns.map((column) => <th key={column.key} className="whitespace-nowrap px-4 py-3 text-start font-semibold"><button className="inline-flex items-center gap-1" onClick={() => toggleSort(column.key)}>{column.label}{sort.key === column.key && (sort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}</button></th>)}<th className="px-4 py-3">إجراء</th></tr></thead>
          <tbody>{pagedRows.map((row, index) => <tr key={row.id} className={`border-t border-slate-100 transition hover:bg-blue-50/70 ${index % 2 ? 'bg-slate-50/45' : 'bg-white/30'}`}><td className="px-4 py-4"><button className="font-bold text-blue-700 hover:underline" onClick={() => onSelect?.(row)}><bdi>{row.source_reference}</bdi></button></td><td className="px-4 py-4">{row.contractor_name || 'غير محدد'}</td><td className="px-4 py-4">{row.district || 'غير محدد'}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(row.source_status)}`}>{row.source_status}</span></td><td className="px-4 py-4">{row.classification}</td><td className="max-w-64 truncate px-4 py-4">{row.project_name || 'الصيانة / خارج المشاريع'}</td><td className="px-4 py-4"><div className="flex gap-1"><button className="icon-button" aria-label={`عرض البلاغ ${row.source_reference}`} title="عرض" onClick={() => onSelect?.(row)}><Eye size={16} /></button><button className="icon-button" aria-label={`تعديل البلاغ ${row.source_reference}`} title="تعديل" onClick={() => onSelect?.(row)}><Pencil size={16} /></button></div></td></tr>)}</tbody>
        </table>
      </div>
      {!visibleRows.length && <p className="p-8 text-center text-slate-500">لا توجد بلاغات مطابقة.</p>}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500"><span>عرض {pagedRows.length.toLocaleString('ar-SA')} من {rows.length.toLocaleString('ar-SA')} بلاغ</span><div className="flex items-center gap-2"><label>صفوف <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="h-8 rounded-lg border px-2"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label><button className="btn secondary px-3 py-1.5" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>السابق</button><span>{page.toLocaleString('ar-SA')} / {pageCount.toLocaleString('ar-SA')}</span><button className="btn secondary px-3 py-1.5" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>التالي</button></div></footer>
    </section>
  );
}
