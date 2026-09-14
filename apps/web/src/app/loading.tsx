import { LoaderCircle } from 'lucide-react';

export default function Loading() {
  return <main className="loading-screen" role="status" aria-label="جارٍ تحميل الصفحة"><LoaderCircle className="animate-spin text-blue-300" size={34} /><span>جارٍ تجهيز لوحة المتابعة…</span><div className="skeleton-block" /></main>;
}
