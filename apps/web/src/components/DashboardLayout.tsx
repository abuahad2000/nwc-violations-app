'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  BarChart3,
  Building2,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Settings,
  Upload,
  X,
  Bell,
  Moon,
  Sun,
  ChevronDown,
} from 'lucide-react';
import type { SessionUser, UserRole } from '@/types';

type LayoutRole = UserRole | 'EXECUTIVE';

const navigation = [
  ['/dashboard', 'لوحة المتابعة', LayoutDashboard],
  ['/violations', 'سجل التعديات', ClipboardList],
  ['/map', 'الخريطة', Map],
  ['/projects', 'مرجع المشاريع', Building2],
  ['/contractors', 'المقاولون', Building2],
  ['/imports', 'استيراد البيانات', Upload],
  ['/reports', 'التقارير', FileSpreadsheet],
  ['/programs', 'مديرو البرامج', BarChart3],
  ['/settings', 'الإعدادات', Settings],
] as const;

function canSee(href: string, role: LayoutRole): boolean {
  if (role === 'CONTRACTOR_USER') return ['/dashboard', '/violations', '/map', '/reports'].includes(href);
  if (href === '/settings') return role === 'SUPER_ADMIN';
  if (href === '/imports') return ['SUPER_ADMIN', 'PROGRAM_MANAGER'].includes(role);
  return true;
}

export default function DashboardLayout({
  user,
  children,
  onLogout,
}: {
  user: SessionUser & { role: LayoutRole };
  children: ReactNode;
  onLogout?: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(() => typeof window === 'undefined' || window.localStorage.getItem('nitaq-theme') !== 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);
  const toggleTheme = () => {
    const nextDark = !dark;
    setDark(nextDark);
    document.documentElement.dataset.theme = nextDark ? 'dark' : 'light';
    window.localStorage.setItem('nitaq-theme', nextDark ? 'dark' : 'light');
  };
  const links = navigation.filter(([href]) => canSee(href, user.role));

  const sidebar = (
    <aside className="tabler-sidebar flex h-full min-h-full flex-col p-4 text-white" aria-label="القائمة الرئيسية">
      <div className="mb-5 border-b border-white/15 pb-5">
        <div className="flex items-center gap-3">
          <span className="brand-mark flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-black text-white">ن</span>
          <div>
            <p className="font-bold">نطاق</p>
            <p className="text-xs text-white/60">متابعة التعديات</p>
          </div>
        </div>
      </div>
      <nav className="space-y-1">
        {links.map(([href, label, Icon]) => (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={pathname === href ? 'page' : undefined}
            className={`nav-link flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${pathname === href ? 'active' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      <button className="mt-auto flex items-center gap-2 rounded-xl px-3 py-3 text-sm text-white/70 hover:bg-white/10 hover:text-white" onClick={onLogout}>
        <LogOut size={18} aria-hidden="true" />
        تسجيل الخروج
      </button>
    </aside>
  );

  return (
    <div dir="rtl" className="dashboard-layout min-h-screen text-slate-900">
      <header className="site-header sticky top-0 z-30 flex min-h-16 items-center justify-between px-4 py-3 sm:px-6">
        <button className="mobile-menu rounded-xl p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="فتح القائمة">
          <Menu size={22} />
        </button>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <button className="icon-button header-action" aria-label="الإشعارات" title="الإشعارات"><Bell size={18} /><span className="notification-badge">3</span></button>
          <button className="icon-button header-action" onClick={toggleTheme} aria-label={dark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الليلي'} title={dark ? 'الوضع الفاتح' : 'الوضع الليلي'}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <div className="text-start">
            <p className="text-xs text-slate-400">المستخدم الحالي</p>
            <p className="font-bold text-white">{user.name}</p>
          </div>
          <span className="hidden rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-100 sm:inline-flex">{user.role}</span>
          <ChevronDown size={16} className="text-blue-100/70" />
        </div>
      </header>
      <div className="mx-auto flex max-w-[1600px] gap-5 p-4 sm:p-6">
        <div className="fixed inset-y-16 right-0 z-40 w-72 overflow-hidden shadow-2xl transition-transform lg:static lg:block lg:h-[calc(100vh-6rem)] lg:w-60 lg:shrink-0 lg:rounded-2xl lg:shadow-none" style={{ transform: open ? 'translateX(0)' : undefined }}>
          <div className="flex h-full flex-col">
            <button className="absolute left-3 top-3 z-10 rounded-lg p-2 text-white hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="إغلاق القائمة"><X size={20} /></button>
            {sidebar}
          </div>
        </div>
        {open && <button className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} aria-label="إغلاق القائمة" />}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
