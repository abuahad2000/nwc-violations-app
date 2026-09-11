'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
type User = { id: string; name: string; email: string; role: string };
export default function SettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
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
        <h2 className="text-2xl font-bold">إدارة الحسابات</h2>
        {message && (
          <p className="surface p-4" role="status">
            {message}
          </p>
        )}
        {allowed && (
          <>
            <form
              className="surface grid gap-4 p-6 sm:grid-cols-2"
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
                <input className="field mt-2" name="name" minLength={2} required />
              </label>
              <label>
                البريد
                <input className="field mt-2" name="email" type="email" required dir="ltr" />
              </label>
              <label>
                كلمة مرور أولية
                <input
                  className="field mt-2"
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
                <select className="field mt-2" name="role">
                  <option value="READER">قارئ</option>
                  <option value="PROGRAM_MANAGER">مدير برنامج</option>
                  <option value="SUPER_ADMIN">مدير نظام</option>
                </select>
              </label>
              <button className="primary" disabled={busy}>
                إنشاء حساب مخول
              </button>
            </form>
            <section className="surface divide-y divide-slate-100 p-6">
              {users.map((u) => (
                <div key={u.id} className="flex flex-wrap justify-between gap-3 py-4">
                  <span>{u.name}</span>
                  <bdi className="text-sm">{u.email}</bdi>
                  <span className="text-sm">{u.role}</span>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
