'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';

interface ContractorRow {
  id: string;
  name: string;
  reported_violations_count: number;
  boundary_violations_count: number;
  assigned_actions_count: number;
  projects_count: number;
}

interface StatsSummary {
  total: number;
  inside_project: number;
  outside_project: number;
  under_review: number;
  pending_actions: number;
  aging: {
    age_0_30: number;
    age_31_90: number;
    age_91_180: number;
    age_181_plus: number;
  };
  last_batch: {
    filename: string;
    file_hash: string;
    imported_rows: number;
    total_rows: number;
    created_at: string;
    status: string;
  } | null;
}

export default function ReportsPage() {
  const [contractors, setContractors] = useState<ContractorRow[]>([]);
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/contractors').then((r) => r.json()),
      fetch('/api/dashboard/stats').then((r) => r.json()),
    ])
      .then(([cData, sData]) => {
        if (cData.status === 'success') setContractors(cData.data);
        if (sData.status === 'success') setStats(sData.data);
        else setError(sData.message || 'تعذر جلب الإحصاءات');
        setLoading(false);
      })
      .catch(() => {
        setError('تعذر جلب التقرير');
        setLoading(false);
      });
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {loading && <p role="status">جارٍ تحميل التقرير…</p>}
        {error && (
          <p className="notice-error" role="alert">
            {error}
          </p>
        )}
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4 print:hidden">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              التقارير التنفيذية وتصدير البيانات المعتمدة
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              تقارير أداء المقاولين والإجراءات المعلقة وتصدير الجداول بصيغة Excel وطباعة الملخص
              التنفيذي
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
            >
              <svg
                className="w-4 h-4 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
              <span>طباعة / حفظ PDF تنفيذي</span>
            </button>
          </div>
        </div>

        {/* Printable Executive Header (Visible only in print) */}
        <div className="hidden print:block border-b-2 border-slate-800 pb-4 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-black text-slate-900">
                شركة المياه الوطنية — وحدة أعمال الرياض
              </h1>
              <p className="text-xs text-slate-600">
                منظومة «نطاق» لحوكمة تعديات البنية التحتية والمقاولين
              </p>
            </div>
            <div className="text-left text-xs font-mono">
              <div>تاريخ التقرير: {new Date().toLocaleDateString('ar-SA')}</div>
              <div>المصدر: قاعدة بيانات محلية معتمدة</div>
            </div>
          </div>
        </div>

        {/* 1-Click Excel Export Suite */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3 print:hidden">
          <h3 className="text-xs font-black text-slate-900">
            حزمة تصدير ملفات Excel الشاملة (تصدير كافة السجلات المطابقة)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <a
              href="/api/reports/export/excel"
              className="p-3 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/30 transition text-right group"
            >
              <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700 mb-1">
                تصدير السجل الكامل
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {stats?.total.toLocaleString('ar-SA') ?? '—'} بلاغ بكافة الحقول
              </div>
            </a>

            <a
              href="/api/reports/export/excel?classification=INSIDE_PROJECT_BOUNDARY"
              className="p-3 rounded-xl border border-blue-200 hover:border-blue-400 bg-blue-50/30 hover:bg-blue-50/60 transition text-right group"
            >
              <div className="text-xs font-bold text-blue-900 mb-1">تصدير داخل نطاق المشاريع</div>
              <div className="text-[11px] text-blue-700 font-mono">
                {stats?.inside_project.toLocaleString('ar-SA') ?? '—'} بلاغ للمقاولين
              </div>
            </a>

            <a
              href="/api/reports/export/excel?classification=UNDER_REVIEW"
              className="p-3 rounded-xl border border-amber-200 hover:border-amber-400 bg-amber-50/30 hover:bg-amber-50/60 transition text-right group"
            >
              <div className="text-xs font-bold text-amber-900 mb-1">
                تصدير حالات المراجعة والتداخل
              </div>
              <div className="text-[11px] text-amber-700 font-mono">
                {stats?.under_review.toLocaleString('ar-SA') ?? '—'} بلاغ قيد التدقيق
              </div>
            </a>

            <a
              href="/api/reports/export/excel?aging=181%2B"
              className="p-3 rounded-xl border border-red-200 hover:border-red-400 bg-red-50/30 hover:bg-red-50/60 transition text-right group"
            >
              <div className="text-xs font-bold text-red-900 mb-1">
                تصدير البلاغات الحرجة (+181 يوم)
              </div>
              <div className="text-[11px] text-red-700 font-mono">
                {stats?.aging.age_181_plus.toLocaleString('ar-SA') ?? '—'} بلاغ متقادم
              </div>
            </a>
          </div>
        </div>

        {/* Executive Summary Numbers (Unified with Dashboard) */}
        {stats && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-black text-slate-900">
              ملخص المؤشرات التنفيذية (تعريف الأعداد موحد مع لوحة المتابعة)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-xl border bg-slate-50">
                <span className="text-[11px] text-slate-500 block">إجمالي البلاغات المسجلة</span>
                <span className="text-xl font-black text-slate-900 font-mono">
                  {stats.total.toLocaleString('ar-SA')}
                </span>
              </div>
              <div className="p-3 rounded-xl border border-blue-100 bg-blue-50/50">
                <span className="text-[11px] text-blue-700 block">داخل حدود المشاريع المعتمدة</span>
                <span className="text-xl font-black text-blue-900 font-mono">
                  {stats.inside_project.toLocaleString('ar-SA')}
                </span>
              </div>
              <div className="p-3 rounded-xl border border-amber-100 bg-amber-50/50">
                <span className="text-[11px] text-amber-700 block">
                  قيد التحقق والتداخل المكاني
                </span>
                <span className="text-xl font-black text-amber-900 font-mono">
                  {stats.under_review.toLocaleString('ar-SA')}
                </span>
              </div>
              <div className="p-3 rounded-xl border border-red-100 bg-red-50/50">
                <span className="text-[11px] text-red-700 block">متقادمة حرجة (+181 يوم)</span>
                <span className="text-xl font-black text-red-900 font-mono">
                  {stats.aging.age_181_plus.toLocaleString('ar-SA')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Contractors Executive Breakdown Table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black text-slate-900">
                تقرير توزيع البلاغات على المقاولين المعتمدين
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                توزيع ثلاثي الأبعاد يفصل المصدر عن النطاق المكاني عن الإجراءات المسندة
              </p>
            </div>
            <span className="text-xs font-bold text-slate-600 font-mono">
              {contractors.length} مقاول
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="p-3">اسم المقاول / الشركة</th>
                  <th className="p-3 text-center">المشاريع المعتمدة</th>
                  <th className="p-3 text-center">أ) وارد بالمصدر</th>
                  <th className="p-3 text-center">ب) داخل نطاق مشاريعه</th>
                  <th className="p-3 text-center">ج) مسند إليه حالياً</th>
                  <th className="p-3 text-center print:hidden">تصدير مخصص</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contractors.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{c.name}</td>
                    <td className="p-3 text-center font-mono font-semibold text-slate-700">
                      {c.projects_count}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-slate-800">
                      {c.reported_violations_count}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-blue-700">
                      {c.boundary_violations_count}
                    </td>
                    <td className="p-3 text-center font-mono font-black text-amber-700">
                      {c.assigned_actions_count}
                    </td>
                    <td className="p-3 text-center print:hidden">
                      <a
                        href={`/api/reports/export/excel?project_contractor=${encodeURIComponent(c.name)}`}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-blue-600 hover:bg-blue-50 text-[10px] font-bold"
                      >
                        Excel
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Executive Sign-off Footer (Print view) */}
        <div className="hidden print:grid grid-cols-3 gap-6 pt-12 text-center text-xs text-slate-800">
          <div>
            <div className="font-bold mb-10">مدير وحدة التعديات والمتابعة</div>
            <div className="border-t border-slate-400 pt-1">التوقيع والاعتماد</div>
          </div>
          <div>
            <div className="font-bold mb-10">مدير البرنامج المعني</div>
            <div className="border-t border-slate-400 pt-1">التوقيع والاعتماد</div>
          </div>
          <div>
            <div className="font-bold mb-10">المدير التنفيذي لقطاع الرياض</div>
            <div className="border-t border-slate-400 pt-1">التوقيع والاعتماد</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
