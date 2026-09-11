'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export default function PasswordPage() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="card surface mx-auto max-w-md space-y-5 p-8"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const f = new FormData(e.currentTarget);
        try {
          const r = await fetch('/api/auth/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current: f.get('current'), password: f.get('password') }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.message);
          router.replace('/login');
        } catch (e) {
          setMessage(e instanceof Error ? e.message : 'تعذر التغيير');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-xl font-bold">تأمين كلمة المرور</h2>
      <p className="text-sm text-slate-500">
        يلزم تغيير كلمة المرور الأولية قبل الوصول إلى البيانات.
      </p>
      <label className="block">
        الكلمة الحالية
        <input
          className="form-control field mt-2"
          name="current"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <label className="block">
        الكلمة الجديدة
        <input
          className="form-control field mt-2"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
      </label>
      {message && (
        <p role="alert" className="notice-error">
          {message}
        </p>
      )}
      <button disabled={busy} className="btn btn-primary primary">
        حفظ وتسجيل الدخول مجددًا
      </button>
    </form>
  );
}
