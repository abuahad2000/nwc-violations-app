'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto max-w-md py-12">
      <form
        className="surface space-y-6 p-8"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          const form = new FormData(e.currentTarget);
          try {
            const response = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            router.replace('/dashboard');
          } catch (error) {
            setError(error instanceof Error ? error.message : 'تعذر الاتصال');
            setBusy(false);
          }
        }}
      >
        <ShieldCheck className="text-teal-700" size={36} />
        <div>
          <h2 className="text-2xl font-bold leading-relaxed">
            مرحبًا بك في التعديات لإدارة المشاريع الرأسمالية
          </h2>
          <p className="mt-2 text-slate-500">سجّل الدخول لمتابعة التعديات والإجراءات.</p>
        </div>
        <label className="block">
          اسم المستخدم أو البريد الإلكتروني
          <input
            name="email"
            type="text"
            autoComplete="username"
            required
            dir="ltr"
            className="field mt-2"
          />
        </label>
        <label className="block">
          كلمة المرور
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="field mt-2"
          />
        </label>
        {error && (
          <p role="alert" className="notice-error">
            {error}
          </p>
        )}
        <button className="primary w-full" disabled={busy}>
          {busy ? 'جارٍ الدخول…' : 'تسجيل الدخول'}
        </button>
        <p className="text-sm text-slate-500">
          الحسابات يصدرها مدير النظام. تواصل معه للحصول على صلاحية الوصول.
        </p>
      </form>
    </div>
  );
}
