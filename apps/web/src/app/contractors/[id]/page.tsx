'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

interface FacetItem {
  id: string;
  source_reference: string;
  reported_contractor_name: string | null;
  project_contractor_name?: string | null;
  project_name?: string | null;
  project_op_number?: string | null;
  classification: string;
  classification_reason: string;
  source_status: string;
  reported_date: string | null;
  incident_date: string | null;
  age_days: number | null;
  district_raw: string | null;
  street_raw: string | null;
  updated_at: string;
  current_action_owner_id?: string | null;
}

interface ContractorDetailData {
  contractor: {
    id: string;
    name: string;
    is_approved: number;
    created_at: string;
  };
  projects: {
    id: string;
    name: string;
    operational_number: string | null;
    violations_in_project: number;
  }[];
  facets: {
    reported: {
      title: string;
      description: string;
      count: number;
      items: FacetItem[];
    };
    boundary: {
      title: string;
      description: string;
      count: number;
      items: FacetItem[];
    };
    assigned: {
      title: string;
      description: string;
      count: number;
      items: FacetItem[];
    };
  };
}

export default function ContractorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [data, setData] = useState<ContractorDetailData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'reported' | 'boundary' | 'assigned'>('boundary');

  useEffect(() => {
    fetch(`/api/contractors/${id}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.status === 'success') setData(res.data);
        else setError(res.message || 'تعذر جلب المقاول');
        setLoading(false);
      })
      .catch(() => {
        setError('تعذر الاتصال بالخادم');
        setLoading(false);
      });
  }, [id]);

  if (error)
    return (
      <AppShell>
        <p role="alert" className="notice-error">
          {error}
        </p>
      </AppShell>
    );
  if (loading) {
    return (
      <AppShell>
        <div className="py-16 text-center text-sm font-semibold text-slate-500">
          جارٍ تحميل ملف المقاول والبلاغات المكانية...
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          المقاول المطلوب غير موجود في قاعدة البيانات المحلية.
        </div>
      </AppShell>
    );
  }

  const { contractor, projects, facets } = data;
  const currentFacet = facets[activeTab];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Breadcrumb & Actions */}
        <div className="flex items-center justify-between">
          <Link
            href="/contractors"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-800 transition"
          >
            ← العودة لقائمة المقاولين
          </Link>
          <a
            href={`/api/reports/export/excel?project_contractor=${encodeURIComponent(contractor.name)}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <span>تصدير بلاغات المقاول (Excel)</span>
          </a>
        </div>

        {/* Contractor Profile Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-black text-slate-900">{contractor.name}</h2>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-sm font-bold text-emerald-700">
                  مقاول معتمد لدى NWC
                </span>
              </div>
              <p className="text-sm text-slate-500 font-mono">المعرف: {contractor.id}</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                <span className="text-slate-500 text-[10px] block">المشاريع المسندة</span>
                <span className="text-base font-black text-slate-900 font-mono">
                  {projects.length}
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                <span className="text-slate-500 text-[10px] block">إجمالي المرتبط</span>
                <span className="text-base font-black text-blue-700 font-mono">
                  {facets.reported.count + facets.boundary.count}
                </span>
              </div>
            </div>
          </div>

          {/* Assigned Projects Pills */}
          {projects.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-sm font-bold text-slate-700 block">
                مشاريع المقاول المعتمدة مكانياً:
              </span>
              <div className="flex flex-wrap gap-2">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-blue-200 bg-blue-50/50 px-3 py-1.5 text-sm text-blue-900 flex items-center gap-2"
                  >
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-[10px] text-blue-600 font-mono bg-white px-1.5 py-0.5 rounded border border-blue-200">
                      {p.operational_number}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      ({p.violations_in_project} بلاغ)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* The 3-Facet Tabs Navigation (Requirement 4 Strict Enforcement) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Facet A Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('reported')}
            className={`p-4 rounded-2xl border text-start transition cursor-pointer ${
              activeTab === 'reported'
                ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-100 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-slate-700">أ) الواردة باسمه في المصدر</span>
              <span className="font-mono text-base font-black text-slate-900">
                {facets.reported.count}
              </span>
            </div>
            <p className="text-sm text-slate-500 leading-tight">
              البلاغات الوارد فيها اسم المقاول صراحة في ملف الجهة المبلغة
            </p>
          </button>

          {/* Facet B Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('boundary')}
            className={`p-4 rounded-2xl border text-start transition cursor-pointer ${
              activeTab === 'boundary'
                ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-100 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-blue-800">ب) داخل نطاق مشاريعه المعتمدة</span>
              <span className="font-mono text-base font-black text-blue-900">
                {facets.boundary.count}
              </span>
            </div>
            <p className="text-sm text-blue-700 leading-tight">
              تعديات أثبت التحقق المكاني وقوعها هندسياً داخل حدود مشاريعه
            </p>
          </button>

          {/* Facet C Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('assigned')}
            className={`p-4 rounded-2xl border text-start transition cursor-pointer ${
              activeTab === 'assigned'
                ? 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-100 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-amber-800">
                ج) الإجراءات المسندة إليه حالياً
              </span>
              <span className="font-mono text-base font-black text-amber-900">
                {facets.assigned.count}
              </span>
            </div>
            <p className="text-sm text-amber-700 leading-tight">
              البلاغات الجارية التي تتطلب معالجة وإجراء مباشر من طاقم المقاول
            </p>
          </button>
        </div>

        {/* Selected Facet Table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden space-y-3">
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900">{currentFacet.title}</h3>
              <p className="text-sm text-slate-500 mt-0.5">{currentFacet.description}</p>
            </div>
            <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-bold text-slate-700 font-mono">
              {currentFacet.count} بلاغ
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-vcenter w-full text-start text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="p-3">رقم البلاغ</th>
                  <th className="p-3">الحالة الأصلية</th>
                  <th className="p-3">الإجراء المطلوب</th>
                  <th className="p-3">صاحب الإجراء الحالي</th>
                  <th className="p-3">سبب الانتظار / التصنيف</th>
                  <th className="p-3">موعد الاستحقاق</th>
                  <th className="p-3">العمر التقويمي</th>
                  <th className="p-3">الحي</th>
                  <th className="p-3">آخر تحديث</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentFacet.items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-slate-400 text-sm">
                      لا توجد بلاغات تندرج تحت هذا التصنيف لهذا المقاول حالياً.
                    </td>
                  </tr>
                ) : (
                  currentFacet.items.map((item) => (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition">
                      <td className="p-3 font-bold text-slate-900 font-mono">
                        #{item.source_reference}
                      </td>
                      <td className="p-3">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-[10px] font-semibold text-slate-700">
                          {item.source_status || 'غير متوفر'}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-800">
                        {item.classification === 'INSIDE_PROJECT_BOUNDARY'
                          ? 'معالجة ميدانية وتنسيق تصريح'
                          : item.classification === 'UNDER_REVIEW'
                            ? 'تدقيق وفك التداخل المكاني'
                            : 'تحويل لفرق الصيانة العامة'}
                      </td>
                      <td className="p-3 text-slate-700">
                        {activeTab === 'assigned'
                          ? contractor.name
                          : item.current_action_owner_id === contractor.id
                            ? contractor.name
                            : 'إدارة تشغيل NWC'}
                      </td>
                      <td
                        className="p-3 text-slate-600 max-w-xs truncate"
                        title={item.classification_reason}
                      >
                        {item.classification_reason || 'غير متوفر'}
                      </td>
                      <td className="p-3 font-mono">
                        {/* No made-up dates! Strictly show 'غير متوفر' if not officially set */}
                        <span className="text-slate-400 italic">غير متوفر</span>
                      </td>
                      <td className="p-3 font-bold font-mono">
                        <span
                          className={`px-2 py-0.5 rounded ${
                            (item.age_days || 0) > 180
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.age_days ?? 'غير متوفر'} يوم
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">{item.district_raw || 'غير متوفر'}</td>
                      <td className="p-3 text-slate-400 text-sm font-mono">
                        {new Date(item.updated_at).toLocaleDateString('ar-SA')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invariant Governance Note */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 space-y-1">
          <div className="font-bold text-slate-800">قواعد الحوكمة المطبقة على ملف المقاول:</div>
          <p className="text-sm leading-relaxed">
            - لا يعتبر البلاغ معلقاً على المقاول إلا إذا كان الإجراء مسنداً إليه صراحة في القسم (ج).
            <br />
            - لا يعتبر أي إجراء متأخراً دون موعد استحقاق تعاقدي معتمد (تظهر الحقول الناقصة «غير
            متوفر» دون اختلاق تواريخ).
            <br />- اسم المقاول الوارد في المصدر مستقل تماماً عن مقاول المشروع الحاوي جغرافياً.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
