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
  X,
} from 'lucide-react';
import { useToast } from './FeedbackProvider';
import type { SessionUser } from '@/types';

const links = [
  { href: '/dashboard', label: 'لوحة المتابعة', icon: LayoutDashboard, color: 'bg-blue-500' },
  { href: '/violations', label: 'سجل التعديات', icon: ClipboardList, color: 'bg-amber-500' },
  { href: '/assignments', label: 'إسناد البلاغات', icon: ClipboardList, color: 'bg-emerald-500' },
  { href: '/map', label: 'الخريطة', icon: Map, color: 'bg-cyan-500' },
  { href: '/contractors', label: 'المقاولون', icon: Building2, color: 'bg-indigo-500' },
  {
    href: '/contractor-management',
    label: 'بيانات المقاولين',
    icon: Settings,
    color: 'bg-rose-500',
  },
];

function SidebarNav({
  user,
  pathname,
  onNavigate,
  onLogout,
}: {
  user: SessionUser | null;
  pathname: string;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="sidebar flex h-full flex-col">
      {/* معلومات المستخدم */}
      <div className="mb-6 rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 p-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20 text-xl font-bold text-white shadow-inner">
            {user?.name?.slice(0, 1) || 'م'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-white">{user?.name || 'المستخدم'}</p>
            <p className="text-xs text-blue-100">مدير النظام</p>
          </div>
        </div>
      </div>

      {/* القائمة */}
      <nav className="flex-1 space-y-1">
        {links.map(({ href, label, icon: Icon, color }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${
                  isActive ? 'bg-white/25 shadow-sm' : color
                }`}
              >
                <Icon size={18} />
              </div>
              <span className="flex-1 truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* تسجيل الخروج */}
      <button
        type="button"
        onClick={onLogout}
        className="sidebar-link mt-4 w-full text-rose-200 hover:bg-rose-500/20 hover:text-white"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/20 text-rose-300">
          <LogOut size={18} />
        </div>
        <span>تسجيل الخروج</span>
      </button>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toast = useToast();
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (r) => {
        if (r.status === 401) {
          router.replace('/login');
          return;
        }
        if (!r.ok) throw new Error('تعذر التحقق من الجلسة');
        const d = await r.json();
        setUser(d.user);
      })
      .catch(() => setError('تعذر الاتصال بالخادم'));
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast('تم تسجيل الخروج', 'success');
      router.replace('/login');
    } catch {
      toast('تعذر تسجيل الخروج', 'error');
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="card-glass max-w-md text-center">
          <Shield className="mx-auto mb-4 h-16 w-16 text-red-500" />
          <h2 className="mb-2 text-xl font-bold">حدث خطأ</h2>
          <p className="text-slate-600">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-primary mt-6 w-full">
            إعادة تحميل
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* الهيدر */}
      <header className="header sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1 rounded-lg hover:bg-slate-100"
            aria-label="فتح القائمة"
          >
            <Menu className="h-6 w-6 text-slate-700" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 text-white shadow-lg">
              <Shield size={20} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800">نظام نطاق</h1>
              <p className="text-xs text-slate-500">إدارة المشاريع الرأسمالية</p>
            </div>
          </div>
        </div>
      </header>

      {/* المحتوى */}
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <div className="flex gap-6">
          {/* الشريط الجانبي - سطح المكتب */}
          <aside
            data-sidebar="desktop"
            className="sidebar-desktop relative z-30 hidden w-64 shrink-0 lg:block"
            aria-label="القائمة الجانبية الرئيسية"
          >
            <SidebarNav
              user={user}
              pathname={pathname}
              onLogout={handleLogout}
            />
          </aside>

          {/* الشريط الجانبي - الجوال */}
          {sidebarOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setSidebarOpen(false)}
              />
              <div className="absolute right-0 top-0 h-full w-72 p-4 bg-slate-900 shadow-2xl">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="absolute left-4 top-4 text-white hover:text-slate-300 p-1"
                  aria-label="إغلاق القائمة"
                >
                  <X size={24} />
                </button>
                <SidebarNav
                  user={user}
                  pathname={pathname}
                  onNavigate={() => setSidebarOpen(false)}
                  onLogout={handleLogout}
                />
              </div>
            </div>
          )}

          {/* المحتوى الرئيسي */}
          <main className="flex-1 min-w-0 animate-fade-in relative z-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
