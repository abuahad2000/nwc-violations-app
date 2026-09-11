'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
type Preview = {
  preview_id: string;
  filename: string;
  total_rows: number;
  added: number;
  changed: number;
  unchanged: number;
  is_duplicate: boolean;
  sample_rows: Record<string, unknown>[];
};
type Batch = {
  id: string;
  filename: string;
  status: string;
  imported_rows: number;
  created_at: string;
};
export default function ImportsPage() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [allowed, setAllowed] = useState(false);
  const load = async () => {
    const r = await fetch('/api/imports');
    const d = await r.json();
    if (!r.ok) {
      setError(d.message);
      return;
    }
    setAllowed(true);
    setBatches(d.data);
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load awaits the network; state is set only after the response.
    void load();
  }, []);
  const action = async (body: FormData | Record<string, string>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const upload = body instanceof FormData;
      const r = await fetch(upload ? '/api/imports/preview' : '/api/imports', {
        method: 'POST',
        headers: upload ? undefined : { 'Content-Type': 'application/json' },
        body: upload ? body : JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      if (d.preview_id) setPreview(d);
      else {
        setMessage(
          d.duplicate
            ? 'الدفعة مستوردة مسبقًا؛ لم تتكرر السجلات'
            : `اكتمل الاستيراد: ${d.imported_rows} سجل جديد أو متغير`,
        );
        setPreview(null);
    void load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر الاستيراد');
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">استيراد البيانات</h2>
          <p className="mt-2 text-slate-500">
            معاينة المصدر والتحقق من الفروق قبل الحفظ. تحفظ النسخ السابقة في سجل التدقيق.
          </p>
        </div>
        {error && (
          <p role="alert" className="notice-error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="card surface p-4 text-teal-800">
            {message}
          </p>
        )}
        {allowed && (
          <section className="card surface space-y-4 p-6">
            <h3 className="font-bold">١. اختيار المصدر</h3>
            <div className="flex flex-wrap items-center gap-4">
              <button
                className="btn secondary"
                disabled={busy}
                onClick={() => action({ action: 'preview-local' })}
              >
                معاينة ملف التعديات المحلي
              </button>
              <label className="block text-sm">
                أو رفع ملف XLSX (حتى 10MB)
                <input
                  aria-label="ملف التعديات"
                  type="file"
                  accept=".xlsx"
                  disabled={busy}
                  className="form-control field mt-2"
                  onChange={(e) => {
                    setPreview(null);
                    const f = e.target.files?.[0];
                    if (f) {
                      const d = new FormData();
                      d.append('file', f);
                      void action(d);
                    }
                  }}
                />
              </label>
            </div>
            <p className="text-sm text-slate-500">
              يلزم عمود «رقم بلاغ التعدي» و«حالة البلاغ» في الورقة الأولى. المعاينة صالحة لمدة30
              دقيقة.
            </p>
          </section>
        )}
        {busy && <p role="status">جارٍ المعالجة…</p>}
        {preview && (
          <section className="card surface space-y-4 p-6">
            <h3 className="font-bold">٢. مراجعة واعتماد: {preview.filename}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['الإجمالي', preview.total_rows],
                ['جديد', preview.added],
                ['متغير', preview.changed],
                ['دون تغيير', preview.unchanged],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm">{label}</p>
                  <strong className="text-2xl">{value}</strong>
                </div>
              ))}
            </div>
            <p className="text-sm">
              تعرض أول5 سجلات فقط. التغيير يعيد السجل للمراجعة المكانية ويحفظ نسخته السابقة؛ لا يبدل
              الإسناد الحالي تلقائيًا.
            </p>
            <div className="overflow-x-auto">
              <table className="table table-vcenter w-full text-start text-sm">
                <thead>
                  <tr>
                    <th>المرجع</th>
                    <th>الحالة</th>
                    <th>المقاول في المصدر</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sample_rows.map((r, i) => (
                    <tr key={i}>
                      <td className="p-3">
                        <bdi>{String(r.source_reference)}</bdi>
                      </td>
                      <td>{String(r.source_status)}</td>
                      <td>{String(r.reported_contractor_name || 'غير محدد')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="btn btn-primary primary"
              disabled={busy || preview.is_duplicate}
              onClick={() => action({ action: 'commit', preview_id: preview.preview_id })}
            >
              {preview.is_duplicate ? 'الملف مستورد مسبقًا' : 'اعتماد الاستيراد وحفظ الفروق'}
            </button>
          </section>
        )}
        <section className="card surface p-6">
          <h3 className="mb-4 font-bold">سجل الدفعات</h3>
          {batches.map((b) => (
            <div
              key={b.id}
              className="flex flex-wrap justify-between gap-2 border-t border-slate-100 py-3"
            >
              <span>{b.filename}</span>
              <span>{b.imported_rows} سجل</span>
              <span>{b.status}</span>
              <time className="text-sm text-slate-500">
                {new Date(b.created_at).toLocaleString('ar-SA')}
              </time>
            </div>
          ))}
          {allowed && !batches.length && <p>لا توجد دفعات بعد.</p>}
        </section>
      </div>
    </AppShell>
  );
}
