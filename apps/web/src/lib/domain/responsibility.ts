export const CLIENT_ACCOUNT_MANAGER = 'عبدالله الأسود';

export type ManualResponsibilityType = 'MAINTENANCE' | 'CLIENT_ACCOUNT';

export function responsibilityLabel(type: ManualResponsibilityType | null | undefined) {
  return type === 'CLIENT_ACCOUNT' ? 'تنفيذ على حساب العميل' : 'إدارة الصيانة';
}

export type ResponsibilityProject = { id: string; contractor_id: string; name: string };
export function initialResponsibility(
  row: { project_id: string | null; reported_contractor_id: string | null },
  projects: ResponsibilityProject[],
) {
  const existing = projects.find((p) => p.id === row.project_id);
  const matches = projects.filter((p) => p.contractor_id === row.reported_contractor_id);
  const project = existing || (matches.length === 1 ? matches[0] : null);
  if (project)
    return {
      project_id: project.id,
      owner_id: project.contractor_id,
      reason: existing
        ? 'إسناد إلى مقاول المشروع المرتبط بالبلاغ'
        : 'ربط إداري بمشروع المقاول الوحيد في المرجع؛ قابل للتعديل بعد المراجعة',
    };
  if (matches.length > 1)
    return {
      project_id: null,
      owner_id: row.reported_contractor_id!,
      reason: 'مسؤولية مقاول المصدر؛ لديه عدة مشاريع ويلزم اختيار المشروع المعني',
    };
  return {
    project_id: null,
    owner_id: 'cont_nwc_operations',
    reason:
      'متابعة الصيانة لعدم وجود مشروع محدد في المرجع، مع حفظ مقاول المصدر وإمكانية التحويل للمشروع الصحيح',
  };
}
