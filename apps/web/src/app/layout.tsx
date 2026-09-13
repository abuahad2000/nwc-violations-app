import type { Metadata } from 'next';
import '@fontsource-variable/noto-sans-arabic';
import './globals.css';
export const metadata: Metadata = {
  title: 'التعديات لإدارة المشاريع الرأسمالية',
  description: 'متابعة التعديات والمشاريع والإجراءات لإدارة المشاريع الرأسمالية',
  robots: { index: false, follow: false, noarchive: true },
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="tabler-app">
        <header className="navbar navbar-light border-b border-slate-200 bg-white px-4 py-4">
          <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3">
            <span
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-900 text-xl font-bold text-white"
              aria-hidden="true"
            >
              ت
            </span>
            <div>
              <h1 className="text-sm font-bold leading-7 sm:text-base">
                التعديات لإدارة المشاريع الرأسمالية
              </h1>
              <p className="text-sm text-slate-500">متابعة التعديات والمشاريع</p>
            </div>
            <span className="ms-auto hidden text-sm text-slate-500 sm:block">
              الرياض · شركة المياه الوطنية
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-3 py-4 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
