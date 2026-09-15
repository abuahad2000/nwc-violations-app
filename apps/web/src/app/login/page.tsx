'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ShieldCheck, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    const form = new FormData(e.currentTarget);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'بيانات الدخول غير صحيحة');

      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الاتصال بالخادم');
      setBusy(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-50 font-['Noto_Sans_Arabic']"
    >
      {/* 1. خلفية حية بتأثير ضبابي (تزيل الكآبة فوراً) */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />
      </div>

      {/* 2. بطاقة الدخول بتأثير الزجاج (Glassmorphism) مع حركة دخول ناعمة */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md rounded-3xl border border-white/50 bg-white/70 p-8 shadow-2xl backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/80"
      >
        {/* الشعار والعنوان */}
        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-500 text-white shadow-lg"
          >
            <ShieldCheck size={32} />
          </motion.div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">نظام نطاق للمشاريع</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            سجّل الدخول لمتابعة التعديات والإجراءات
          </p>
        </div>

        {/* نموذج الدخول */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* حقل البريد/المستخدم */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              اسم المستخدم أو البريد الإلكتروني
            </label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                name="email"
                type="text"
                autoComplete="username"
                required
                dir="ltr" // حافظنا عليها لضمان كتابة الإيميل بشكل صحيح
                className="w-full rounded-xl border border-slate-200 bg-white/80 py-3 pr-10 pl-4 text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white dark:focus:border-blue-400"
                placeholder="username@example.com"
              />
            </div>
          </div>

          {/* حقل كلمة المرور */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              كلمة المرور
            </label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-slate-200 bg-white/80 py-3 pr-10 pl-4 text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white dark:focus:border-blue-400"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* رسالة الخطأ (تظهر بحركة ناعمة) */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-600 dark:bg-rose-900/20 dark:text-rose-400"
            >
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* زر الدخول التفاعلي */}
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.4)' }}
            whileTap={{ scale: 0.98 }}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-blue-600 to-emerald-600 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {busy ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                جارٍ الدخول...
              </>
            ) : (
              'تسجيل الدخول'
            )}
          </motion.button>
        </form>

        {/* الملاحظة السفلية */}
        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          الحسابات يصدرها مدير النظام. تواصل معه للحصول على صلاحية الوصول.
        </p>
      </motion.div>
    </div>
  );
}
