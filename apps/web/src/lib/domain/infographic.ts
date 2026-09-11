export type InfographicData = {
  generated_at: string;
  summary: { total: number; closed: number; pending: number; over180: number; unassigned: number };
  projects: {
    id: string;
    name: string;
    status: string;
    operational_number: string;
    contractor_name: string;
    total: number;
    pending: number;
  }[];
  contractors: { id: string; name: string; pending: number; over180: number }[];
};
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
export function infographicSVG(data: InfographicData) {
  const n = (v: number) => v.toLocaleString('ar-SA');
  const text = (x: number, y: number, value: string, size = 24, color = '#182433') =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="start" direction="rtl">${escape(value)}</text>`;
  const rect = (x: number, y: number, w: number, h: number, fill: string) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${fill}"/>`;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1700" viewBox="0 0 1100 1700" style="font-family:'Sakkal Majalla',Arial,sans-serif"><title>إنفوجرافيك المشاريع والبلاغات المعلقة</title>${rect(0, 0, 1100, 1700, '#f3f6fb')}${rect(35, 30, 1030, 180, '#182433')}${text(1020, 95, 'التعديات لإدارة المشاريع الرأسمالية', 38, '#ffffff')}${text(1020, 143, 'المشاريع • البلاغات المعلقة • متابعة المقاولين', 28, '#c8e0f4')}${text(1020, 185, 'تاريخ التقرير: ' + new Date(data.generated_at).toLocaleDateString('ar-SA', { timeZone: 'Asia/Riyadh' }), 20, '#c8e0f4')}`;
  const metrics = [
    ['المشاريع', data.projects.length, '#206bc4'],
    ['البلاغات المعلقة', data.summary.pending, '#d97706'],
    ['تمت المعالجة', data.summary.closed, '#059669'],
    ['أكثر من 180 يومًا', data.summary.over180, '#e11d48'],
  ] as const;
  metrics.forEach(([label, value, color], i) => {
    const x = 825 - i * 265;
    svg +=
      rect(x, 235, 240, 130, 'white') +
      text(x + 218, 277, label, 24) +
      text(x + 218, 337, n(value), 46, color);
  });
  svg +=
    rect(35, 390, 1030, 110, '#fff7e6') +
    text(1020, 435, `معلّق بلا مقاول مسند: ${n(data.summary.unassigned)} بلاغ`, 28, '#92400e') +
    text(
      1020,
      475,
      'الترتيب أدناه حسب الإسناد الحالي للبلاغات غير المغلقة، وليس اسم المقاول الوارد بالمصدر.',
      21,
      '#92400e',
    );
  const groups = [
    {
      title: 'أكثر المقاولين لديهم بلاغات معلقة',
      rows: data.contractors.slice(0, 8),
      y: 525,
      color: '#206bc4',
    },
    {
      title: 'أكثر المشاريع لديها بلاغات معلقة',
      rows: data.projects.filter((p) => p.pending > 0).slice(0, 6),
      y: 1090,
      color: '#0891b2',
    },
  ];
  for (const group of groups) {
    svg +=
      rect(35, group.y, 1030, group.y === 525 ? 540 : 515, 'white') +
      text(1020, group.y + 45, group.title, 30);
    const max = Math.max(1, ...group.rows.map((r) => r.pending));
    group.rows.forEach((r, i) => {
      const y = group.y + 94 + i * 55;
      const name = r.name.length > 76 ? r.name.slice(0, 73) + '…' : r.name;
      svg +=
        text(1020, y, name, 21) +
        text(95, y, n(r.pending), 24, group.color) +
        rect(110, y + 12, 910, 7, '#e9eff6') +
        rect(1020 - (910 * r.pending) / max, y + 12, (910 * r.pending) / max, 7, group.color);
    });
    if (!group.rows.length) svg += text(1020, group.y + 100, 'لا توجد بلاغات معلقة مرتبطة.', 24);
  }
  svg +=
    text(
      1020,
      1648,
      'المعلّق = كل بلاغ غير مغلق • الأعداد تعكس بيانات النظام وقت إعداد التقرير.',
      21,
      '#62748b',
    ) +
    text(
      1020,
      1680,
      `يعرض الرسم أعلى ٨ مقاولين وأعلى ٦ مشاريع؛ إجمالي البلاغات: ${n(data.summary.total)}.`,
      21,
      '#62748b',
    ) +
    '</svg>';
  return svg;
}
