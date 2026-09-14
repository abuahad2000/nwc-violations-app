'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
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
  const links = navigation.filter(([href]) => canSee(href, user.role));

  const sidebar = (
    <aside className="flex h-full min-h-full flex-col bg-[#102c35] p-4 text-white" aria-label="القائمة الرئيسية">
      <div className="mb-5 border-b border-white/15 pb-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#d7f4e9] text-lg font-black text-[#102c35]">ن</span>
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
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${pathname === href ? 'bg-[#d7f4e9] text-[#102c35]' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
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
    <div dir="rtl" className="min-h-screen bg-[#f5f8f8] text-[#173f43]">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 shadow-sm backdrop-blur sm:px-6">
        <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="فتح القائمة">
          <Menu size={22} />
        </button>
        <div className="mr-auto flex items-center gap-3">
          <div className="text-start">
            <p className="text-xs text-slate-500">المستخدم الحالي</p>
            <p className="font-bold">{user.name}</p>
          </div>
          <span className="rounded-full bg-[#e6f6ef] px-3 py-1 text-xs font-semibold text-[#167257]">{user.role}</span>
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
