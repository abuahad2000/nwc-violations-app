export type ServiceType = 'WATER' | 'SEWER' | 'MIXED' | 'UNKNOWN';
export const serviceLabels: Record<ServiceType, string> = {
  WATER: 'مياه',
  SEWER: 'صرف صحي',
  MIXED: 'مياه وصرف صحي',
  UNKNOWN: 'غير محدد / مراجعة',
};
export const serviceColors: Record<ServiceType, string> = {
  WATER: '#01579b',
  SEWER: '#097138',
  MIXED: '#7c3aed',
  UNKNOWN: '#64748b',
};
export type ServiceInfo = { service_type: ServiceType; service_source: string };
export function serviceFromName(name: string): ServiceType {
  const water = /مياه|مياة|\bwater\b/i.test(name);
  const sewer = /صرف|\bsewer(?:age)?\b|\bwastewater\b/i.test(name);
  return water && sewer ? 'MIXED' : water ? 'WATER' : sewer ? 'SEWER' : 'UNKNOWN';
}
export function serviceFromReference(color: string, file: string): ServiceType {
  const type =
    color.toLowerCase() === '#01579b'
      ? 'WATER'
      : color.toLowerCase() === '#097138'
        ? 'SEWER'
        : 'UNKNOWN';
  const fileType = serviceFromName(file);
  if (type !== 'UNKNOWN' && fileType !== 'UNKNOWN' && fileType !== type && fileType !== 'MIXED')
    return 'UNKNOWN';
  return type;
}
export function classifyProjectService(
  name: string,
  references: { color: string; source_file: string }[],
): ServiceInfo {
  const named = serviceFromName(name);
  if (!references.length)
    return {
      service_type: named,
      service_source:
        named === 'UNKNOWN' ? 'لا يوجد نوع صريح في اسم المشروع' : 'اسم المشروع في مرجع Excel',
    };
  const types = new Set(references.map((r) => serviceFromReference(r.color, r.source_file)));
  if (types.has('UNKNOWN'))
    return {
      service_type: 'UNKNOWN',
      service_source: 'لون غير معتمد أو تعارض مع ملف الطبقة؛ للمراجعة',
    };
  const referenced = types.size > 1 ? 'MIXED' : [...types][0];
  if (named !== 'UNKNOWN' && named !== 'MIXED' && referenced !== named)
    return {
      service_type: 'UNKNOWN',
      service_source: 'تعارض اسم المشروع مع نوع النطاق المعتمد؛ للمراجعة',
    };
  return {
    service_type: named === 'MIXED' ? 'MIXED' : referenced,
    service_source: 'ألوان نطاقات KMZ المعتمدة ومرجع المشروع',
  };
}
