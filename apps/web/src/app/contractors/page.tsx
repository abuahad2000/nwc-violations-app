'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

interface ContractorSummary {
  id: string;
  name: string;
  is_approved: number;
  reported_violations_count: number;
  boundary_violations_count: number;
  assigned_actions_count: number;
  projects_count: number;
}

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<ContractorSummary[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/contractors')
      .then((res) => res.json())
      .then((res) => {
        if (res.status === 'success') setContractors(res.data);
        else setError(res.message || 'تعذر جلب المقاولين');
        setLoading(false);
      })
      .catch(() => {
        setError('تعذر الاتصال بالخادم');
        setLoading(false);
      });
  }, []);

  const filtered = contractors.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <AppShell>
      <div className="space-y-6">
        {error && (
          <p className="notice-error" role="alert">
            {error}
          </p>
        )}
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              إدارة مقاولي مشاريع المياه والصرف الصحي
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              متابعة أداء المقاولين مع الفصل التام بين بلاغات المصدر، والتعديات الواقعة داخل نطاقات
              مشاريعهم، والإجراءات المسندة إليهم
            </p>
          </div>
          <div>
            <span className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-sm font-bold text-blue-700">
              {contractors.length} مقاول نشط بالنظام
            </span>
          </div>
        </div>

        {/* Search Input */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم المقاول أو الشركة..."
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Contractors Grid */}
        {loading ? (
          <div className="py-12 text-center text-sm font-semibold text-slate-500">
            جارٍ تحميل بيانات المقاولين والمشاريع...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-blue-400 hover:shadow-xs transition space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-sm text-slate-900 leading-snug">{c.name}</h3>
                    <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      معتمد
                    </span>
                  </div>
                  <div className="text-sm text-slate-500">
                    عدد المشاريع المسندة:{' '}
                    <span className="font-bold text-slate-800 font-mono">{c.projects_count}</span>
                  </div>
                </div>

                {/* 3-Facet Summary Counters */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] text-slate-500 mb-0.5">وارد بالمصدر</div>
                    <div className="text-base font-black text-slate-800 font-mono">
                      {c.reported_violations_count}
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-blue-50/60 border border-blue-100">
                    <div className="text-[10px] text-blue-700 mb-0.5">داخل نطاقه</div>
                    <div className="text-base font-black text-blue-900 font-mono">
                      {c.boundary_violations_count}
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-amber-50/60 border border-amber-100">
                    <div className="text-[10px] text-amber-700 mb-0.5">مسند حالياً</div>
                    <div className="text-base font-black text-amber-900 font-mono">
                      {c.assigned_actions_count}
                    </div>
                  </div>
                </div>

                <Link
                  href={`/contractors/${c.id}`}
                  className="w-full text-center rounded-xl bg-slate-100 py-2 text-sm font-bold text-slate-700 hover:bg-blue-600 hover:text-white transition shadow-2xs"
                >
                  عرض ملف المقاول وتفصيل البلاغات الثلاثية ←
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
