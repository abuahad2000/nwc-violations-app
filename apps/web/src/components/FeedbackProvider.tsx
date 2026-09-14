'use client';

import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; kind: ToastKind };
type FeedbackContextValue = { toast: (message: string, kind?: ToastKind) => void };
const FeedbackContext = createContext<FeedbackContextValue | null>(null);
const icons = { success: CheckCircle2, error: AlertCircle, info: Info };

export function useToast() {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error('useToast يجب أن يستخدم داخل FeedbackProvider');
  return value.toast;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current.slice(-3), { id, message, kind }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4500);
  }, []);
  const context = useMemo(() => ({ toast }), [toast]);
  return <FeedbackContext.Provider value={context}>{children}<div className="toast-region" aria-live="polite" aria-atomic="true">{items.map((item) => { const Icon = icons[item.kind]; return <div key={item.id} className={`toast toast-${item.kind}`} role={item.kind === 'error' ? 'alert' : 'status'}><Icon size={18} /><span>{item.message}</span><button className="toast-close" aria-label="إغلاق الإشعار" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}><X size={15} /></button></div>; })}</div></FeedbackContext.Provider>;
}

export function EmptyState({ title = 'لا توجد بيانات', description = 'لا توجد سجلات مطابقة للعرض الحالي.' }: { title?: string; description?: string }) {
  return <div className="empty-state" role="status"><span className="empty-state-icon">∅</span><h3>{title}</h3><p>{description}</p></div>;
}

export function ConfirmDialog({ open, title, description, confirmLabel = 'تأكيد', busy = false, onConfirm, onCancel }: { open: boolean; title: string; description: string; confirmLabel?: string; busy?: boolean; onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => { if (!open) return; const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [open, onCancel]);
  if (!open) return null;
  return <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><h2 id="confirm-title">{title}</h2><p>{description}</p><div className="flex justify-end gap-2"><button className="btn secondary" onClick={onCancel} disabled={busy}>إلغاء</button><button className="btn primary" onClick={onConfirm} disabled={busy}>{busy ? 'جارٍ التنفيذ…' : confirmLabel}</button></div></section></div>;
}
