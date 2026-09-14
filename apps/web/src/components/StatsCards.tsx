'use client';

import { AlertCircle, CheckCircle2, ClipboardList, HardHat } from 'lucide-react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { motion } from 'framer-motion';

export type StatsCardValues = {
  total: number;
  contractor: number;
  entity: number;
  processed: number;
};

const cards = [
  { key: 'total', label: 'إجمالي البلاغات', icon: ClipboardList, tone: 'blue' },
  { key: 'contractor', label: 'تحت معالجة المقاول', icon: HardHat, tone: 'amber' },
  { key: 'entity', label: 'تحت معالجة الجهة', icon: AlertCircle, tone: 'rose' },
  { key: 'processed', label: 'تمت المعالجة', icon: CheckCircle2, tone: 'emerald' },
] as const;

const tones = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  rose: 'bg-rose-50 text-rose-700 ring-rose-100',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
} as const;

export default function StatsCards({ values, deltas = {}, details = {}, loading = false, onSelect }: { values: StatsCardValues; deltas?: Partial<Record<keyof StatsCardValues, number>>; details?: Partial<Record<keyof StatsCardValues, string>>; loading?: boolean; onSelect?: (key: keyof StatsCardValues) => void }) {
  return (
    <section aria-label="الإحصائيات الرئيسية" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ key, label, icon: Icon, tone }, index) => (
        <motion.button
          key={key}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: index * 0.07 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect?.(key)}
          className="metric-card group rounded-2xl border border-white/50 bg-white/85 p-5 text-start shadow-lg backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-xl"
          aria-label={`عرض ${label}`}
        >
          <div className="flex items-start justify-between gap-3">
            <motion.span
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2 }}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${tones[tone]}`}
            ><Icon size={22} aria-hidden="true" /></motion.span>
            <span className="text-sm text-slate-500">{label}</span>
          </div>
          {loading ? <div className="mt-5 h-9 w-24 animate-pulse rounded-lg bg-slate-200" aria-label="جارٍ التحميل" /> : <motion.strong initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-5 block text-3xl tracking-tight text-[#173f43]">{values[key].toLocaleString('ar-SA')}</motion.strong>}
          {!loading && deltas[key] !== undefined && <span title={details[key] || 'مقارنة بالأسبوع السابق'} className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${deltas[key]! >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{deltas[key]! >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}{Math.abs(deltas[key]!).toLocaleString('ar-SA')}% عن الأسبوع السابق</span>}
          <span className="mt-2 block text-xs text-slate-400 transition group-hover:text-slate-600">عرض التفاصيل ←</span>
        </motion.button>
      ))}
    </section>
  );
}
