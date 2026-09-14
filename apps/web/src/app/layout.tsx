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
        <div className="app-backdrop" aria-hidden="true">
          <span className="orb orb-one" />
          <span className="orb orb-two" />
          <span className="orb orb-three" />
        </div>
        <header className="site-header px-4 py-4">
          <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3">
            <span
              className="brand-mark grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl font-bold text-white"
              aria-hidden="true"
            >
              ت
            </span>
            <div>
              <h1 className="text-sm font-bold leading-7 text-white sm:text-base">
                التعديات لإدارة المشاريع الرأسمالية
              </h1>
              <p className="text-sm text-blue-100/70">متابعة التعديات والمشاريع</p>
            </div>
            <span className="ms-auto hidden text-sm text-blue-100/70 sm:block">
              الرياض · شركة المياه الوطنية
            </span>
          </div>
        </header>
        <main className="relative z-10 mx-auto max-w-[1600px] px-3 py-4 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
