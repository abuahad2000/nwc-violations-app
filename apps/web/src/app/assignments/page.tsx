'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import * as Dialog from '@radix-ui/react-dialog';
type Row = {
  current_action_owner_id: string | null;
  project_manager_name: string | null;
  manager_override: string | null;
  id: string;
  source_reference: string;
  source_status: string;
  updated_at: string;
  contractor_name: string | null;
  reported_contractor_id: string | null;
  owner_name: string | null;
  project_name: string | null;
  latitude: number | null;
  longitude: number | null;
  district_raw: string | null;
};
type Project = {
  id: string;
  name: string;
  contractor_id: string;
  contractor_name: string;
  operational_number: string;
  project_manager_name: string | null;
};
type Data = {
  rows: Row[];
  total: number;
  page: number;
  projects: Project[];
  contractors: { id: string; name: string }[];
  stats: { total: number; open: number; closed: number };
};
export default function Assignments() {
  const [data, setData] = useState<Data | null>(null);
  const [filters, setFilters] = useState({
    contractor: '',
    search: '',
    state: 'OPEN',
    scope: 'ALL',
    page: '1',
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [destination, setDestination] = useState('PROJECT');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [projectId, setProjectId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [managerMode, setManagerMode] = useState('CUSTOM');
  const [managerName, setManagerName] = useState('');
  const [managerReason, setManagerReason] = useState('');
  const [managerError, setManagerError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/assignments?' + new URLSearchParams(filters), { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.message);
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [filters, revision]);
  const change = (value: Partial<typeof filters>) => {
    setLoading(true);
    setSelected([]);
    setFilters({ ...filters, ...value, page: value.page || '1' });
  };
  const project = data?.projects.find((p) => p.id === projectId);
  return (
    <AppShell>
      <Dialog.Root
        open={!!editing}
        onOpenChange={(open) => {
          if (!open && !busy) setEditing(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/50" />
          <Dialog.Content
            dir="rtl"
            className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <Dialog.Title className="text-xl font-bold">
              تعديل متابعة البلاغ {editing?.source_reference}
            </Dialog.Title>
            <Dialog.Description className="my-3 text-slate-600">
              التعديل خاص بهذا البلاغ، ولا يغيّر مدير المشروع في بقية البلاغات.
            </Dialog.Description>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editing) return;
                setBusy(true);
                setManagerError('');
                try {
                  const maintenance = managerMode === 'MAINTENANCE';
                  const res = await fetch('/api/assignments', {
                    method: maintenance ? 'POST' : 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(
                      maintenance
                        ? {
                            records: [{ id: editing.id, updated_at: editing.updated_at }],
                            destination: 'MAINTENANCE',
                            reason: managerReason,
                          }
                        : {
                            id: editing.id,
                            updated_at: editing.updated_at,
                            manager_name: managerMode === 'INHERIT' ? '' : managerName,
                            reason: managerReason,
                          },
                    ),
                  });
                  const result = await res.json();
                  if (!res.ok) throw Error(result.message);
                  setMessage(result.message);
                  setEditing(null);
                  setSelected([]);
                  setLoading(true);
                  setRevision((r) => r + 1);
                } catch (e) {
                  setManagerError(e instanceof Error ? e.message : 'تعذر الحفظ');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="block">
                نوع التعديل
                <select
                  aria-label="نوع التعديل"
                  className="form-control field"
                  disabled={busy}
                  value={managerMode}
                  onChange={(e) => setManagerMode(e.target.value)}
                >
                  <option
                    value="CUSTOM"
                    disabled={editing?.current_action_owner_id === 'cont_nwc_operations'}
                  >
                    مدير مختلف لهذا البلاغ
                  </option>
                  <option value="INHERIT">استخدام المدير الأصلي للمشروع</option>
                  <option value="MAINTENANCE">تحويل إلى الصيانة</option>
                </select>
              </label>
              {managerMode === 'CUSTOM' && (
                <label className="block">
                  مدير هذا البلاغ
                  <input
                    aria-label="مدير هذا البلاغ"
                    list="project-manager-names"
                    className="form-control field"
                    required
                    maxLength={200}
                    disabled={busy}
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                  />
                </label>
              )}
              <datalist id="project-manager-names">
                {[
                  ...new Set(data?.projects.map((p) => p.project_manager_name).filter(Boolean)),
                ].map((name) => (
                  <option key={name} value={name!} />
                ))}
              </datalist>
              {managerMode === 'MAINTENANCE' && (
                <p className="rounded-xl bg-blue-50 p-3">
                  ستصبح الصيانة الجهة المسؤولة عن البلاغ، مع حفظ مقاول المصدر. يمكنك ربطه بمشروع
                  لاحقًا من صفحة الإسناد.
                </p>
              )}
              <label className="block">
                سبب تعديل المتابعة
                <input
                  aria-label="سبب تعديل المتابعة"
                  className="form-control field"
                  required
                  minLength={5}
                  maxLength={1000}
                  disabled={busy}
                  value={managerReason}
                  onChange={(e) => setManagerReason(e.target.value)}
                />
              </label>
              {managerError && (
                <p role="alert" className="notice-error">
                  {managerError}
                </p>
              )}
              <div className="flex gap-3">
                <button className="btn primary" disabled={busy}>
                  حفظ تعديل البلاغ
                </button>
                <Dialog.Close asChild>
                  <button type="button" className="btn secondary" disabled={busy}>
                    إلغاء
                  </button>
                </Dialog.Close>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <div className="space-y-5">
        <header className="rounded-2xl bg-[#182433] p-6 text-white">
          <h2 className="text-2xl font-bold text-white">إسناد البلاغات وتحديد المشروع</h2>
          <p className="mt-2 text-slate-200">
            المقاول الواحد قد يرتبط بعدة مشاريع. اختر مشروع البلاغ بالاسم والرقم التشغيلي أو حوّل
            مسؤولية المتابعة إلى الصيانة.
          </p>
        </header>
        {error && (
          <p role="alert" className="notice-error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">
            {message}
          </p>
        )}
        {data && (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                ['بلا جهة مسؤولة', data.stats.total],
                ['منها مفتوح', data.stats.open || 0],
                ['منها مغلق', data.stats.closed || 0],
              ].map(([label, count]) => (
                <div key={String(label)} className="card surface p-4">
                  <p className="text-sm">{label}</p>
                  <strong className="text-3xl">{Number(count).toLocaleString('ar-SA')}</strong>
                </div>
              ))}
            </div>
            <div className="card surface grid gap-3 p-4 md:grid-cols-3">
              <label>
                العرض
                <select
                  aria-label="العرض"
                  className="form-control field"
                  value={filters.scope}
                  disabled={busy}
                  onChange={(e) => change({ scope: e.target.value })}
                >
                  <option value="UNASSIGNED">بلاغات بلا جهة</option>
                  <option value="NO_PROJECT">بلاغات تحتاج تحديد المشروع</option>
                  <option value="MAINTENANCE">بلاغات الصيانة</option>
                  <option value="ALL">جميع البلاغات / تعديل الإسناد</option>
                </select>
              </label>
              <label>
                الحالة
                <select
                  className="form-control field"
                  value={filters.state}
                  disabled={busy}
                  onChange={(e) => change({ state: e.target.value })}
                >
                  <option value="OPEN">المفتوح</option>
                  <option value="CLOSED">المغلق</option>
                  <option value="ALL">الكل</option>
                </select>
              </label>
              <label>
                المقاول في المصدر
                <select
                  aria-label="المقاول في المصدر"
                  className="form-control field"
                  value={filters.contractor}
                  disabled={busy}
                  onChange={(e) => change({ contractor: e.target.value })}
                >
                  <option value="">الكل</option>
                  {data.contractors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              البحث برقم البلاغ أو الحي
              <input
                className="form-control field"
                value={filters.search}
                disabled={busy}
                onChange={(e) => change({ search: e.target.value })}
              />
            </label>
            <form
              className="card surface space-y-4 p-5"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  const response = await fetch('/api/assignments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      records: data.rows
                        .filter((r) => selected.includes(r.id))
                        .map((r) => ({ id: r.id, updated_at: r.updated_at })),
                      destination,
                      project_id: projectId,
                      reason,
                    }),
                  });
                  const d = await response.json();
                  if (!response.ok) throw Error(d.message);
                  setMessage(d.message + ' (' + d.assigned + ')');
                  setSelected([]);
                  setLoading(true);
                  setRevision((r) => r + 1);
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'تعذر الحفظ');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h3 className="text-xl font-bold">
                تحديد الجهة للبلاغات المختارة ({selected.length})
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  نوع الجهة
                  <select
                    aria-label="نوع الجهة"
                    className="form-control field"
                    disabled={busy}
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  >
                    <option value="PROJECT">مشروع — المسؤول مقاول المشروع</option>
                    <option value="MAINTENANCE">إدارة الصيانة</option>
                  </select>
                </label>
                {destination === 'PROJECT' && (
                  <>
                    <label>
                      تصفية مشاريع المقاول
                      <select
                        aria-label="تصفية مشاريع المقاول"
                        className="form-control field"
                        disabled={busy}
                        value={ownerFilter}
                        onChange={(e) => {
                          setOwnerFilter(e.target.value);
                          setProjectId('');
                        }}
                      >
                        <option value="">جميع المقاولين</option>
                        {data.contractors
                          .filter((c) => data.projects.some((p) => p.contractor_id === c.id))
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} (
                              {data.projects.filter((p) => p.contractor_id === c.id).length} مشاريع)
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="md:col-span-2">
                      المشروع
                      <select
                        aria-label="المشروع"
                        className="form-control field"
                        required
                        disabled={busy}
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                      >
                        <option value="">اختر المشروع المعني بالبلاغ</option>
                        {data.projects
                          .filter((p) => !ownerFilter || p.contractor_id === ownerFilter)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {p.operational_number}
                            </option>
                          ))}
                      </select>
                    </label>
                  </>
                )}
              </div>
              {destination === 'PROJECT' && project && (
                <p className="rounded-xl bg-blue-50 p-3 text-blue-900">
                  المسؤول: {project.contractor_name} · مدير المشروع:{' '}
                  {project.project_manager_name || 'غير محدد'}
                </p>
              )}
              <label className="block">
                سبب التحديد
                <input
                  className="form-control field"
                  required
                  minLength={5}
                  maxLength={1000}
                  disabled={busy}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="مرجع الربط أو سبب التحويل للصيانة"
                />
              </label>
              <button className="btn primary" disabled={busy || loading || !selected.length}>
                اعتماد الجهة للبلاغات المحددة
              </button>
              <p className="text-sm text-slate-500">
                هذا ربط إداري للمتابعة، وتظل مطابقة الحدود المكانية مستقلة. البلاغ المغلق يبقى
                مغلقًا ولا يُنشأ له إجراء مفتوح.
              </p>
            </form>
            <section className="card surface overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <h3 className="font-bold">البلاغات ({data.total.toLocaleString('ar-SA')})</h3>
                <label className="ms-auto">
                  <input
                    type="checkbox"
                    disabled={busy || loading || !data.rows.length}
                    checked={!!data.rows.length && selected.length === data.rows.length}
                    onChange={(e) =>
                      setSelected(e.target.checked ? data.rows.map((r) => r.id) : [])
                    }
                  />{' '}
                  تحديد بلاغات الصفحة
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="table w-full min-w-[850px]">
                  <thead>
                    <tr>
                      {[
                        'تحديد',
                        'البلاغ / الحالة',
                        'المقاول في المصدر',
                        'المشروع والجهة الحالية',
                        'مدير المشروع / المتابعة',
                        'الموقع',
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <input
                            aria-label={'تحديد البلاغ ' + r.source_reference}
                            type="checkbox"
                            disabled={busy || loading}
                            checked={selected.includes(r.id)}
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? [...selected, r.id]
                                  : selected.filter((id) => id !== r.id),
                              )
                            }
                          />
                        </td>
                        <td>
                          <bdi>{r.source_reference}</bdi>
                          <p>{r.source_status}</p>
                        </td>
                        <td>{r.contractor_name || 'غير محدد'}</td>
                        <td>
                          {r.project_name || 'مشروع غير محدد'}
                          <p>{r.owner_name || 'بلا جهة'}</p>
                        </td>
                        <td>
                          <p>{r.project_manager_name || 'غير محدد'}</p>
                          {r.manager_override && <small>تحديد خاص بالبلاغ</small>}
                          <button
                            className="btn secondary mt-2"
                            disabled={busy || loading}
                            onClick={() => {
                              setEditing(r);
                              setManagerName(r.manager_override || r.project_manager_name || '');
                              setManagerMode(
                                r.current_action_owner_id === 'cont_nwc_operations'
                                  ? 'MAINTENANCE'
                                  : 'CUSTOM',
                              );
                              setManagerReason('');
                              setManagerError('');
                            }}
                          >
                            تعديل متابعة البلاغ {r.source_reference}
                          </button>
                        </td>
                        <td>
                          {r.district_raw}
                          {r.latitude != null && r.longitude != null && (
                            <a
                              className="block text-blue-700 underline"
                              href={
                                'https://www.google.com/maps/search/?api=1&query=' +
                                encodeURIComponent(r.latitude + ',' + r.longitude)
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              فتح الموقع
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.rows.length && <p className="p-5">لا توجد بلاغات ضمن هذا العرض.</p>}
              <div className="flex justify-between p-4">
                <button
                  className="btn secondary"
                  disabled={busy || loading || data.page <= 1}
                  onClick={() => change({ page: String(data.page - 1) })}
                >
                  السابق
                </button>
                <span>
                  {data.page} / {Math.max(1, Math.ceil(data.total / 50))}
                </span>
                <button
                  className="btn secondary"
                  disabled={busy || loading || data.page * 50 >= data.total}
                  onClick={() => change({ page: String(data.page + 1) })}
                >
                  التالي
                </button>
              </div>
            </section>
          </>
        )}
        {loading && <p role="status">جارٍ تحميل البلاغات…</p>}
      </div>
    </AppShell>
  );
}
