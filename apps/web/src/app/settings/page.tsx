'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { Sheet } from '@/components/ui/sheet';
type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  username: string | null;
  delete_reason: string;
  active_sessions: number;
  activity: number;
};
export default function SettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);
  const load = async () => {
    const r = await fetch('/api/users');
    const d = await r.json();
    if (!r.ok) {
      setMessage(d.message);
      return;
    }
    setUsers(d.data);
    setAllowed(true);
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load awaits the network; state is set only after the response.
    void load();
  }, []);
  return (
    <AppShell>
      <div className="space-y-6">
        <header className="dashboard-hero">
          <p className="mb-2 text-sm text-cyan-100">إعدادات مساحة العمل</p>
          <h2 className="text-2xl font-bold">إدارة الحسابات</h2>
          <p className="mt-3 text-sm text-slate-200">
            إنشاء الحسابات ومراجعة استخدامها وإزالة الحسابات غير المستخدمة.
          </p>
        </header>
        {message && (
          <p className="card surface p-4" role="status">
            {message}
          </p>
        )}
        {allowed && (
          <>
            <form
              className="card surface grid gap-4 p-6 sm:grid-cols-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const f = new FormData(form);
                setBusy(true);
                try {
                  const r = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(Object.fromEntries(f)),
                  });
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.message);
                  setMessage('تم إنشاء الحساب');
                  form.reset();
                  await load();
                } catch (e) {
                  setMessage(e instanceof Error ? e.message : 'تعذر إنشاء الحساب');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                الاسم
                <input className="form-control field mt-2" name="name" minLength={2} required />
              </label>
              <label>
                البريد
                <input className="form-control field mt-2" name="email" type="email" required dir="ltr" />
              </label>
              <label>
                كلمة مرور أولية
                <input
                  className="form-control field mt-2"
                  name="password"
                  type="password"
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                />
              </label>
              <label>
                الدور
                <select className="form-control field mt-2" name="role">
                  <option value="READER">قارئ</option>
                  <option value="PROGRAM_MANAGER">مدير برنامج</option>
                  <option value="SUPER_ADMIN">مدير نظام</option>
                </select>
              </label>
              <button className="btn btn-primary primary" disabled={busy}>
                إنشاء حساب مخول
              </button>
            </form>
            <section className="card surface divide-y divide-slate-100 p-6">
              {users.map((u) => (
                <div key={u.id} className="flex flex-wrap justify-between gap-3 py-4">
                  <div>
                    <span className="font-bold">{u.name}</span>
                    <p className="mt-1 text-xs text-slate-500">
                      {u.username || 'دخول بالبريد'} ·{' '}
                      {u.active_sessions ? 'جلسة سارية' : 'لا توجد جلسة سارية'}
                    </p>
                  </div>
                  <bdi className="text-sm">{u.email}</bdi>
                  <span className="text-sm">
                    {(
                      {
                        SUPER_ADMIN: 'مدير النظام',
                        PROGRAM_MANAGER: 'مدير برنامج',
                        PROJECT_MANAGER: 'مدير مشروع',
                        READER: 'قارئ',
                        EDITOR: 'محرر',
                        CONTRACTOR_USER: 'مقاول',
                      } as Record<string, string>
                    )[u.role] || u.role}
                  </span>
                  <div className="max-w-64">
                    <button
                      className="btn secondary text-rose-700"
                      disabled={busy || !!u.delete_reason}
                      onClick={() => setDeleting(u)}
                      aria-label={`حذف حساب ${u.name}`}
                    >
                      حذف الحساب
                    </button>
                    <p className="mt-2 text-xs text-slate-500">
                      {u.delete_reason || 'لا توجد جلسة سارية أو إجراءات مسجلة؛ قابل للحذف'}
                    </p>
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
      <Sheet
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
        title="حذف حساب غير مستخدم"
      >
        <p className="leading-8">
          سيتم حذف حساب <strong>{deleting?.name}</strong> (<bdi>{deleting?.email}</bdi>) وبيانات
          دخوله. ستُسجّل العملية في سجل التدقيق.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            disabled={busy}
            className="btn btn-primary primary bg-rose-700 hover:bg-rose-800"
            onClick={async () => {
              if (!deleting) return;
              setBusy(true);
              try {
                const r = await fetch('/api/users', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: deleting.id }),
                });
                const d = await r.json();
                if (!r.ok) throw new Error(d.message);
                setMessage(d.message);
                setDeleting(null);
                await load();
              } catch (e) {
                setMessage(e instanceof Error ? e.message : 'تعذر حذف الحساب');
                setDeleting(null);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'جارٍ الحذف…' : 'تأكيد حذف الحساب'}
          </button>
          <button className="btn secondary" disabled={busy} onClick={() => setDeleting(null)}>
            إلغاء
          </button>
        </div>
      </Sheet>
    </AppShell>
  );
}
