'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  Map,
  Building2,
  Settings,
  LogOut,
  Bell,
  User,
  Shield,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from './FeedbackProvider';
import type { SessionUser } from '@/types';

const navigationItems = [
  { title: 'لوحة المتابعة', url: '/dashboard', icon: LayoutDashboard },
  { title: 'سجل التعديات', url: '/violations', icon: ClipboardList },
  { title: 'إسناد البلاغات', url: '/assignments', icon: ClipboardList },
  { title: 'الخريطة', url: '/map', icon: Map },
  { title: 'المقاولون', url: '/contractors', icon: Building2 },
  { title: 'بيانات المقاولين', url: '/contractor-management', icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState('');
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

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Shield className="mx-auto h-16 w-16 text-destructive" />
          <h2 className="text-xl font-bold">حدث خطأ</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => window.location.reload()}>إعادة تحميل</Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* الشريط الجانبي */}
      <Sidebar>
        <SidebarHeader className="border-b p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                {user?.name?.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{user?.name}</span>
              <span className="text-xs text-muted-foreground">مدير النظام</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>القائمة الرئيسية</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigationItems.map((item) => {
                  const isActive = pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t p-4">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              toast('تم تسجيل الخروج', 'success');
              router.replace('/login');
            }}
          >
            <LogOut className="h-4 w-4" />
            <span>تسجيل الخروج</span>
          </Button>
        </SidebarFooter>
      </Sidebar>

      {/* المحتوى الرئيسي */}
      <div className="flex flex-1 flex-col">
        {/* الهيدر */}
        <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-sm font-bold">نظام نطاق</h1>
                <p className="text-xs text-muted-foreground">إدارة المشاريع الرأسمالية</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                {user?.name?.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* المحتوى */}
        <main className="flex-1 overflow-auto p-6 bg-muted/30">{children}</main>
      </div>
    </div>
  );
}
