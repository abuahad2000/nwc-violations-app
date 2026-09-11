import { db } from '@/lib/db/async';
export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: string;
  created_at: string;
  active_sessions: number;
  activity: number;
};
export const managedUsersSQL = `SELECT u.id,u.name,u.email,u.username,u.role,u.created_at,
  (SELECT count(*) FROM sessions s WHERE s.user_id=u.id AND s.expires_at>?) active_sessions,
  ((SELECT count(*) FROM audit_events a WHERE a.performed_by=u.id)
   +(SELECT count(*) FROM import_batches b WHERE b.imported_by=u.id)
   +(SELECT count(*) FROM tasks t WHERE t.created_by=u.id)
   +(SELECT count(*) FROM reference_approvals r WHERE r.approved_by=u.id)) activity
  FROM users u`;
export function removalReason(user: ManagedUser, actorId: string, adminCount: number) {
  if (user.id === actorId) return 'لا يمكن حذف حسابك الحالي';
  if (user.role === 'SUPER_ADMIN' && adminCount <= 1) return 'لا يمكن حذف آخر مدير نظام';
  if (user.active_sessions > 0) return 'توجد جلسة دخول سارية؛ يلزم تسجيل الخروج أولًا';
  if (user.activity > 0) return 'للحساب نشاط محفوظ؛ لا يعد حسابًا غير مستخدم';
  return '';
}
export async function managedUsers() {
  return (await db
    .prepare(managedUsersSQL + ' ORDER BY u.created_at DESC')
    .all(new Date().toISOString())) as ManagedUser[];
}
