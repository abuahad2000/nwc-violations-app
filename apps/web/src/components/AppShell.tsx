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
  ['/violations', 'سجل التعديات', ClipboardList],
  ['/map', 'الخريطة', Map],
  ['/contractors', 'المقاولون', Building2],
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
    <div className="flex h-full flex-col gap-6">
      <div>
        <p className="font-semibold">{user?.name}</p>
        <p className="mt-1 text-sm text-slate-500">مساحة المتابعة التشغيلية</p>
      </div>
      <nav aria-label="القائمة الرئيسية" className="space-y-1">
        {links
          .filter(([href]) =>
            href === '/settings'
              ? user?.role === 'SUPER_ADMIN'
              : href === '/imports'
                ? ['SUPER_ADMIN', 'PROGRAM_MANAGER'].includes(user?.role || '')
                : user?.role === 'CONTRACTOR_USER'
                  ? !['/contractors', '/projects', '/programs'].includes(href)
                  : true,
          )
          .map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              aria-current={pathname === href ? 'page' : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${pathname === href ? 'bg-gradient-to-l from-cyan-700 to-brand-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Icon size={20} />
              {label}
            </Link>
          ))}
      </nav>
      <button
        className="secondary mt-auto"
        onClick={async () => {
          const r = await fetch('/api/auth/logout', { method: 'POST' });
          if (r.ok) router.replace('/login');
          else setError('تعذر تسجيل الخروج');
        }}
      >
        <LogOut size={18} />
        تسجيل الخروج
      </button>
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
      <button className="secondary self-start lg:hidden print:hidden" onClick={() => setOpen(true)}>
        <Menu size={20} />
        القائمة
      </button>
      <aside className="surface app-navigation sticky top-4 hidden h-[calc(100vh-130px)] w-60 shrink-0 p-4 lg:block">
        {navigation}
      </aside>
      <Sheet open={open} onOpenChange={setOpen} title="القائمة">
        {navigation}
      </Sheet>
      <div className="min-w-0 flex-1 pb-8">{children}</div>
    </div>
  );
}
