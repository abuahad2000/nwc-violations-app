import type { Metadata } from 'next';
import '@fontsource-variable/noto-sans-arabic';
import './globals.css';
import { FeedbackProvider } from '@/components/FeedbackProvider';

export const metadata: Metadata = {
  title: 'نطاق | التعديات لإدارة المشاريع الرأسمالية',
  description: 'متابعة التعديات والمشاريع والإجراءات لإدارة المشاريع الرأسمالية',
  robots: { index: false, follow: false, noarchive: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="tabler-app">
        {/* خلفية متحركة بتأثير الزجاج */}
        <div className="app-backdrop" aria-hidden="true">
          <span className="orb orb-one" />
          <span className="orb orb-two" />
          <span className="orb orb-three" />
        </div>

        {/* الهيدر العصري */}
        <header className="site-header px-4 py-4">
          <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3">
            {/* الشعار المتدرج مع تأثير حركي */}
            <div className="brand-mark grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl font-bold text-white shadow-lg transition-transform hover:scale-105">
              <span className="relative">
                ت
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              </span>
            </div>

            {/* النص والعنوان */}
            <div className="flex-1">
              <h1 className="text-sm font-bold leading-7 text-white sm:text-base">
                نظام نطاق للمشاريع
              </h1>
              <p className="text-sm text-blue-100/70">متابعة التعديات والمشاريع</p>
            </div>

            {/* معلومات الموقع */}
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-blue-100/90">الرياض · شركة المياه الوطنية</span>
              </div>
            </div>
          </div>
        </header>

        {/* المحتوى الرئيسي */}
        <FeedbackProvider>
          <main className="relative z-10 mx-auto max-w-[1600px] px-3 py-4 sm:px-6">{children}</main>
        </FeedbackProvider>

        {/* Footer بسيط */}
        <footer className="relative z-10 mt-8 border-t border-white/10 bg-white/5 py-4 text-center text-xs text-blue-100/60 backdrop-blur-sm">
          <p>© 2026 نظام نطاق - جميع الحقوق محفوظة</p>
        </footer>
      </body>
    </html>
  );
}
