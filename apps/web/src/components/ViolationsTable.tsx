'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';

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
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<{ key: keyof ViolationTableRow; direction: 'asc' | 'desc' }>({ key: 'source_reference', direction: 'asc' });
  const statuses = useMemo(() => [...new Set(rows.map((row) => row.source_status).filter(Boolean))], [rows]);
  const visibleRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ar');
    return rows
      .filter((row) => !status || row.source_status === status)
      .filter((row) => !query || Object.values(row).some((value) => String(value ?? '').toLocaleLowerCase('ar').includes(query)))
      .sort((a, b) => {
        const left = String(a[sort.key] ?? '');
        const right = String(b[sort.key] ?? '');
        const result = left.localeCompare(right, 'ar', { numeric: true });
        return sort.direction === 'asc' ? result : -result;
      });
  }, [rows, search, status, sort]);
  const toggleSort = (key: keyof ViolationTableRow) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));

  return (
    <section dir="rtl" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="جدول البلاغات">
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
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-slate-50 text-slate-600"><tr>{columns.map((column) => <th key={column.key} className="whitespace-nowrap px-4 py-3 text-start font-semibold"><button className="inline-flex items-center gap-1" onClick={() => toggleSort(column.key)}>{column.label}{sort.key === column.key && (sort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}</button></th>)}</tr></thead>
          <tbody>{visibleRows.map((row) => <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-4 py-4"><button className="font-bold text-teal-700 hover:underline" onClick={() => onSelect?.(row)}><bdi>{row.source_reference}</bdi></button></td><td className="px-4 py-4">{row.contractor_name || 'غير محدد'}</td><td className="px-4 py-4">{row.district || 'غير محدد'}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(row.source_status)}`}>{row.source_status}</span></td><td className="px-4 py-4">{row.classification}</td><td className="max-w-64 truncate px-4 py-4">{row.project_name || 'الصيانة / خارج المشاريع'}</td></tr>)}</tbody>
        </table>
      </div>
      {!visibleRows.length && <p className="p-8 text-center text-slate-500">لا توجد بلاغات مطابقة.</p>}
      <footer className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">عرض {visibleRows.length.toLocaleString('ar-SA')} من {rows.length.toLocaleString('ar-SA')} بلاغ</footer>
    </section>
  );
}
