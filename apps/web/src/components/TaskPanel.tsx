'use client';
import { useEffect, useState } from 'react';
type Task = {
  id: string;
  owner_name: string;
  reason: string;
  status: string;
  due_date: string | null;
  created_at: string;
};
export default function TaskPanel({
  id,
  owner,
  updatedAt,
  isClosed,
  onSaved,
}: {
  id: string;
  owner: string | null;
  updatedAt: string;
  isClosed: boolean;
  onSaved: () => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contractors, setContractors] = useState<{ id: string; name: string }[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/tasks?violation_id=${encodeURIComponent(id)}`, { signal: c.signal })
      .then((r) => r.json())
      .then((d) => {
        setTasks(d.tasks || []);
        setAllowed(d.can_write || false);
        setContractors(d.contractors || []);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError('تعذر جلب الإجراءات');
      });
    return () => c.abort();
  }, [id, updatedAt]);
  return (
    <section className="space-y-4 border-t border-slate-200 pt-5">
      <h3 className="font-bold">الإجراءات وسجل الإسناد</h3>
      {error && (
        <p role="alert" className="notice-error">
          {error}
        </p>
      )}
      {tasks.length ? (
        tasks.map((t) => (
          <div key={t.id} className="rounded-xl bg-slate-50 p-3">
            <p className="font-medium">
              {t.owner_name} · {t.status === 'OPEN' ? 'نشط' : 'سابق / مغلق'}
            </p>
            <p className="mt-2 text-sm">{t.reason}</p>
            <p className="mt-2 text-xs text-slate-500">
              الموعد: {t.due_date || 'لم تحدد مهلة'} ·{' '}
              {new Date(t.created_at).toLocaleDateString('ar-SA')}
            </p>
          </div>
        ))
      ) : (
        <p className="text-sm text-slate-500">لا يوجد إجراء مسجل.</p>
      )}
      {allowed && !isClosed && (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setError('');
            try {
              const r = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  violation_id: id,
                  owner_id: f.get('owner_id'),
                  reason: f.get('reason'),
                  due_date: f.get('due_date') || null,
                  expected_owner: owner,
                  expected_updated_at: updatedAt,
                }),
              });
              const d = await r.json();
              if (!r.ok) throw new Error(d.message);
              onSaved();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'تعذر الإسناد');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block text-sm">
            الجهة المسؤولة
            <select className="form-control field mt-2" name="owner_id" defaultValue={owner || ''} required>
              <option value="">حدد الجهة</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            سبب الإسناد
            <input className="form-control field mt-2" name="reason" minLength={5} maxLength={1000} required />
          </label>
          <label className="block text-sm">
            موعد معتمد (اختياري)
            <input className="form-control field mt-2" name="due_date" type="date" />
          </label>
          <button className="btn btn-primary primary" disabled={busy}>
            حفظ الإسناد
          </button>
        </form>
      )}
    </section>
  );
}
