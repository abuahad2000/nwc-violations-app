import type { Metadata } from 'next';
import '@fontsource-variable/noto-sans-arabic';
import './globals.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarProvider } from '@/components/ui/sidebar';
import { FeedbackProvider } from '@/components/FeedbackProvider';

export const metadata: Metadata = {
  title: 'نطاق | التعديات لإدارة المشاريع الرأسمالية',
  description: 'متابعة التعديات والمشاريع والإجراءات لإدارة المشاريع الرأسمالية',
  robots: { index: false, follow: false, noarchive: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-[family-name:var(--font-geist-sans)]">
        <TooltipProvider>
          <SidebarProvider>
            <FeedbackProvider>{children}</FeedbackProvider>
          </SidebarProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
