import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center space-y-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 text-2xl font-bold">
        ✕
      </div>
      <h2 className="text-xl font-bold text-slate-900">403 — غير مصرح بالوصول</h2>
      <p className="text-sm text-slate-600 max-w-md">
        ليس لديك صلاحية للاطلاع على هذا السجل أو تنفيذ هذا الإجراء. تم تسجيل محاولة الوصول في سجل
        التدقيق الأمني (Audit Log).
      </p>
      <Link
        href="/"
        className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
      >
        العودة للرئيسية
      </Link>
    </div>
  );
}
