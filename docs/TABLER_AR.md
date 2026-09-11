# قالب Tabler

تستخدم الواجهة الحزمة الرسمية المجانية `@tabler/core` بالإصدار `1.5.1` وترخيص MIT، مع قائمة جانبية عربية وبطاقات وأزرار ونماذج وجداول Tabler.

- المصدر: https://tabler.io/admin-template
- الدمج مع Next.js: https://docs.tabler.io/ui/getting-started/frameworks/nextjs
- نص الترخيص محفوظ في `licenses/Tabler-LICENSE.txt`.

يشغّل `npm run build` و`npm run dev` أداة `apps/web/scripts/build/prepare-tabler.mjs` لبناء Sass وتحويله إلى RTL. الملف `src/styles/tabler.generated.css` ناتج بناء لا يُعدّل يدويًا ولا يُرفع للمستودع.

تُحمّل أنماط Tabler في طبقة CSS مستقلة. عُطّلت شبكة Bootstrap الاختيارية وأولوية `!important` لأدواته لتجنب التعارض مع شبكة Tailwind الحالية. تُستخدم الخطوط العربية المحلية، وتبقى أحداث النوافذ والتنقل تحت إدارة React وRadix.

الدمج يخص العرض فقط؛ لا يغيّر بيانات البلاغات أو الإسناد أو صلاحيات المستخدمين.
