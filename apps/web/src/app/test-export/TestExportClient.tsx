'use client';
import { useEffect, useState } from 'react';
type Project = { id: string; name: string; operational_number: string };
type Exported = { url: string; size: number; points: number };
export default function TestExportClient({ canExport }: { canExport: boolean }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [exports, setExports] = useState<Record<string, Exported>>({});
  const [error, setError] = useState('');
  useEffect(() => { fetch('/api/projects').then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.message || 'تعذر تحميل المشاريع'); setProjects(data.projects || []); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر تحميل المشاريع')); }, []);
  async function exportProject(project: Project) {
    setError('');
    const response = await fetch(`/api/export/kmz/${encodeURIComponent(project.id)}`);
    if (!response.ok) { setError('تعذر تصدير المشروع؛ تحقق من الصلاحية ووجود نطاق معتمد.'); return; }
    const blob = await response.blob();
    setExports((current) => ({ ...current, [project.id]: { url: URL.createObjectURL(blob), size: blob.size, points: Number(response.headers.get('x-kmz-point-count') || 0) } }));
  }
  return <main dir="rtl" className="space-y-5"><header><p className="text-sm text-slate-500">اختبار الميزة التنافسية</p><h1 className="text-3xl font-black">تصدير KMZ للمشاريع</h1></header>{error && <p role="alert" className="notice-error">{error}</p>}{!canExport && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">التصدير يتطلب صلاحية مدير المشروع أو أعلى.</p>}<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-4 text-start">الرقم التشغيلي</th><th className="p-4 text-start">المشروع</th><th className="p-4 text-start">الإجراء</th></tr></thead><tbody>{projects.map((project) => { const result = exports[project.id]; return <tr key={project.id} className="border-t border-slate-100"><td className="p-4"><bdi>{project.operational_number}</bdi></td><td className="p-4">{project.name}</td><td className="p-4">{result ? <span className="flex flex-wrap items-center gap-3"><a className="btn btn-primary primary" href={result.url} download={`${project.operational_number}.kmz`}>تحميل KMZ ({Math.ceil(result.size / 1024)} KB)</a><span className="text-xs text-slate-500">{result.points.toLocaleString('ar-SA')} نقطة</span><a className="btn secondary" href="https://earth.google.com/web/" target="_blank" rel="noopener noreferrer">فتح Google Earth Web</a></span> : <button disabled={!canExport} className="btn btn-primary primary" onClick={() => void exportProject(project)}>تصدير KMZ</button>}</td></tr>; })}</tbody></table>{!projects.length && !error && <p className="p-8 text-center text-slate-500">جارٍ تحميل المشاريع…</p>}</section></main>;
}
