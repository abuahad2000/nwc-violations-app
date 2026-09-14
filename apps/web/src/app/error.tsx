'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="error-state" role="alert"><AlertTriangle size={42} /><h1>تعذر تحميل هذه الصفحة</h1><p>حدث خطأ مؤقت أثناء جلب البيانات. حاول مرة أخرى.</p><button className="btn primary" onClick={() => reset()}><RotateCcw size={17} /> إعادة المحاولة</button></main>;
}
