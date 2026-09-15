'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  Map,
  Building2,
  Menu,
  LogOut,
  Settings,
  Shield,
  ChevronLeft,
  Bell,
  User,
} from 'lucide-react';
import { Sheet } from './ui/sheet';
import { useToast } from './FeedbackProvider';
import type { SessionUser } from '@/types';

const links = [
  ['/dashboard', 'لوحة المتابعة', LayoutDashboard, 'bg-blue-500'],
  ['/infographic', 'إنفوجرافيك المشاريع', LayoutDashboard, 'bg-purple-500'],
  ['/violations', 'سجل التعديات', ClipboardList, 'bg-amber-500'],
  ['/assignments', 'إسناد البلاغات', ClipboardList, 'bg-emerald-500'],
  ['/map', 'الخريطة التشغيلية', Map, 'bg-cyan-500'],
  ['/contractors', 'المقاولون', Building2, 'bg-indigo-500'],
  ['/contractor-management', 'بيانات المقاولين', Settings, 'bg-rose-500'],
] as const;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const toast = useToast();
  const pathname = usePathname();

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/me', { signal: controller.signal })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace('/login');
          return;
        }
        if (!r.ok) throw new Error('تعذر التحقق من الجلسة');
        const d = await r.json();
        if (d.user.must_change_password) {
          router.replace('/password');
          return;
        }
        setUser(d.user);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError('تعذر الاتصال بالخادم. أعد تحميل الصفحة.');
      });
    return () => controller.abort();
  }, [router]);

  // تأثير التمرير للهيدر
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navigation = (
    <div className="flex h-full flex-col gap-6 rounded-2xl bg-gradient-to-b from-slate-900/95 to-slate-800/95 p-5 backdrop-blur-xl shadow-2xl border border-white/10">
      {/* معلومات المستخدم */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-500 p-5 text-white shadow-lg">
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold shadow-lg backdrop-blur-sm">
            {user?.name?.slice(0, 1) || 'م'}
          </div>
          <div className="flex-1">
            <p className="text-base font-bold">{user?.name}</p>
            <p className="text-xs text-blue-100/80">مساحة المتابعة</p>
          </div>
        </div>
      </div>

      {/* القائمة الرئيسية */}
      <nav aria-label="القائمة الرئيسية" className="flex-1 space-y-2 overflow-y-auto">
        {links.map(([href, label, Icon, colorClass]) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-white/10 text-white shadow-lg before:absolute before:left-0 before:top-1/2 before:h-8 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-white'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white hover:translate-x-1'
              }`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
                  isActive
                    ? `${colorClass} text-white shadow-md`
                    : 'bg-slate-700/50 text-slate-400 group-hover:bg-slate-700'
                }`}
              >
                <Icon size={18} />
              </div>
              <span className="flex-1">{label}</span>
              {isActive && <ChevronLeft size={16} className="text-white/60" />}
            </Link>
          );
        })}
      </nav>

      {/* زر تسجيل الخروج */}
      <button
        onClick={async () => {
          const r = await fetch('/api/auth/logout', { method: 'POST' });
          if (r.ok) {
            toast('تم تسجيل الخروج بنجاح', 'success');
            router.replace('/login');
          } else {
            setError('تعذر تسجيل الخروج');
            toast('تعذر تسجيل الخروج، حاول مجددًا', 'error');
          }
        }}
        className="group flex items-center gap-3 rounded-xl border border-white/10 bg-gradient-to-r from-rose-600/20 to-orange-600/20 px-4 py-3 text-sm font-semibold text-rose-200 transition-all hover:from-rose-600/30 hover:to-orange-600/30 hover:shadow-lg hover:shadow-rose-500/10"
      >
        <LogOut size={18} className="transition-transform group-hover:-translate-x-1" />
        تسجيل الخروج
      </button>

      {/* حقوق الملكية */}
      <p className="text-center text-xs text-slate-500">نظام نطاق © {new Date().getFullYear()}</p>
    </div>
  );

  if (error)
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="surface max-w-md rounded-2xl p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
            <Shield size={32} />
          </div>
          <h2 className="mb-2 text-xl font-bold text-slate-800">حدث خطأ</h2>
          <p className="text-slate-600">{error}</p>
          <button onClick={() => window.location.reload()} className="primary mt-6 w-full">
            إعادة تحميل الصفحة
          </button>
        </div>
      </div>
    );

  if (!user)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="text-slate-600">جارٍ التحقق من الدخول…</p>
        </div>
      </div>
    );

  return (
    <div className="app-shell relative min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      {/* الهيدر العلوي العصري */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white/90 shadow-lg backdrop-blur-xl' : 'bg-white/70 backdrop-blur-md'
        } border-b border-slate-200/60`}
      >
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6">
          {/* الشعار */}
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="فتح القائمة">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg transition-transform active:scale-95">
                <Menu size={20} />
              </div>
            </button>
            <div className="hidden items-center gap-3 sm:flex">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 text-white shadow-lg">
                <Shield size={20} />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-800">نظام نطاق</h1>
                <p className="text-xs text-slate-500">إدارة المشاريع الرأسمالية</p>
              </div>
            </div>
          </div>

          {/* الإجراءات */}
          <div className="flex items-center gap-2">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition-all hover:bg-blue-50 hover:text-blue-600"
              aria-label="الإشعارات"
            >
              <div className="relative">
                <Bell size={20} />
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  3
                </span>
              </div>
            </button>
            <div className="hidden items-center gap-3 border-l border-slate-200 pl-3 sm:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-emerald-500 text-white font-bold shadow-md">
                {user?.name?.slice(0, 1) || 'م'}
              </div>
              <div className="hidden lg:block">
                <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
                <p className="text-xs text-slate-500">مدير النظام</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-6 sm:px-6">
        {/* الشريط الجانبي - سطح المكتب */}
        <aside className="sticky top-24 hidden h-[calc(100vh-140px)] w-72 shrink-0 lg:block">
          {navigation}
        </aside>

        {/* القائمة المتنقلة */}
        <Sheet open={open} onOpenChange={setOpen} title="القائمة الرئيسية">
          {navigation}
        </Sheet>

        {/* المحتوى */}
        <main className="min-w-0 flex-1 pb-8">{children}</main>
      </div>
    </div>
  );
}
