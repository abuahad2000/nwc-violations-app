import type { Metadata } from 'next';
import '@fontsource-variable/noto-sans-arabic';
import './globals.css';
export const metadata: Metadata = {
  title: 'نطاق | متابعة التعديات',
  description: 'متابعة التعديات والمشاريع والإجراءات',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <header className="border-b border-slate-200 bg-white px-4 py-4">
          <div className="mx-auto flex max-w-[1600px] items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-900 text-xl font-bold text-white">
              ن
            </span>
            <div>
              <h1 className="font-bold">نطاق</h1>
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
