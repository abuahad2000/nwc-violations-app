'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  Map,
  Building2,
  FileSpreadsheet,
  Upload,
  Menu,
  LogOut,
  Settings,
} from 'lucide-react';
import { Sheet } from './ui/sheet';
import type { SessionUser } from '@/types';
const links = [
  ['/dashboard', 'لوحة المتابعة', LayoutDashboard],
  ['/infographic', 'إنفوجرافيك المشاريع', LayoutDashboard],
  ['/violations', 'سجل التعديات', ClipboardList],
  ['/map', 'الخريطة', Map],
  ['/contractors', 'المقاولون', Building2],
  ['/contractor-management', 'تعديل بيانات المقاولين', Settings],
  ['/projects', 'مرجع المشاريع', Building2],
  ['/imports', 'الاستيراد', Upload],
  ['/reports', 'التقارير', FileSpreadsheet],
  ['/programs', 'مديرو البرامج', Building2],
  ['/settings', 'إدارة الحسابات', Settings],
] as const;
export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
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
  const navigation = (
    <div className="tabler-sidebar flex h-full flex-col gap-5 p-4">
      <div className="border-b border-slate-600 pb-5">
        <span className="avatar mb-3 bg-blue-600 text-white">{user?.name?.slice(0, 1)}</span>
        <p className="font-semibold">{user?.name}</p>
        <p className="sidebar-muted mt-1 text-xs">مساحة المتابعة التشغيلية</p>
      </div>
      <nav aria-label="القائمة الرئيسية" className="nav flex-column space-y-1">
        {links
          .filter(([href]) =>
            href === '/settings' || href === '/contractor-management'
              ? user?.role === 'SUPER_ADMIN'
              : href === '/imports'
                ? ['SUPER_ADMIN', 'PROGRAM_MANAGER'].includes(user?.role || '')
                : user?.role === 'CONTRACTOR_USER'
                  ? !['/contractors', '/projects', '/programs', '/infographic'].includes(href)
                  : true,
          )
          .map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              aria-current={pathname === href ? 'page' : undefined}
              className={`nav-link flex items-center gap-3 px-3 py-3 text-sm font-semibold ${pathname === href ? 'active' : ''}`}
            >
              <Icon size={20} />
              {label}
            </Link>
          ))}
      </nav>
      <button
        className="btn secondary sidebar-logout mt-auto"
        onClick={async () => {
          const r = await fetch('/api/auth/logout', { method: 'POST' });
          if (r.ok) router.replace('/login');
          else setError('تعذر تسجيل الخروج');
        }}
      >
        <LogOut size={18} />
        تسجيل الخروج
      </button>
      <a
        href="https://tabler.io"
        target="_blank"
        rel="noopener noreferrer"
        className="sidebar-muted text-center text-xs"
      >
        Tabler · MIT
      </a>
    </div>
  );
  if (error)
    return (
      <p role="alert" className="notice-error">
        {error}
      </p>
    );
  if (!user)
    return (
      <p role="status" className="p-8">
        جارٍ التحقق من الدخول…
      </p>
    );
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:gap-6">
      <button
        className="btn secondary self-start lg:hidden print:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu size={20} />
        القائمة
      </button>
      <aside className="app-navigation sticky top-4 hidden h-[calc(100vh-130px)] min-h-[720px] w-60 shrink-0 lg:block">
        {navigation}
      </aside>
      <Sheet open={open} onOpenChange={setOpen} title="القائمة">
        {navigation}
      </Sheet>
      <div className="min-w-0 flex-1 pb-8">{children}</div>
    </div>
  );
}
