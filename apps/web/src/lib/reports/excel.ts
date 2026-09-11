import ExcelJS from 'exceljs';
export function googleMapsURL(latitude: unknown, longitude: unknown) {
  if (latitude == null || longitude == null || latitude === '' || longitude === '') return null;
  const lat = Number(latitude),
    lon = Number(longitude);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180 ||
    (lat === 0 && lon === 0)
  )
    return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`;
}
export async function exportViolationsWorkbook(rows: Record<string, unknown>[]) {
  const book = new ExcelJS.Workbook();
  book.creator = 'إدارة المشاريع الرأسمالية';
  book.created = new Date();
  const sheet = book.addWorksheet('تقرير التعديات والمقاولين', {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 1, rightToLeft: true }],
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: '1:1',
    },
  });
  const keys = rows.length
    ? Object.keys(rows[0])
    : ['رقم البلاغ', 'حالة البلاغ في المصدر', 'خط العرض', 'خط الطول'];
  const columns = [...keys, 'الموقع على Google Maps'];
  sheet.columns = columns.map((key) => ({
    header: key,
    key,
    width:
      key.includes('وصف') || key.includes('سبب')
        ? 54
        : key.includes('اسم المشروع')
          ? 48
          : key.includes('مدير') || key.includes('مقاول')
            ? 32
            : key.includes('تاريخ')
              ? 22
              : 25,
  }));
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, rows.length + 1), column: columns.length },
  };
  for (const entry of rows) {
    const row = sheet.addRow(
      Object.fromEntries(
        keys.map((key) => {
          const value = entry[key];
          return [
            key,
            typeof value === 'string' && /^[=+@\-\t\r]/.test(value) ? "'" + value : value,
          ];
        }),
      ),
    );
    const link = googleMapsURL(entry['خط العرض'], entry['خط الطول']);
    row.getCell(columns.length).value = link
      ? { text: 'فتح الموقع في Google Maps', hyperlink: link, tooltip: 'عرض موقع البلاغ' }
      : 'إحداثيات غير متاحة';
    const lines = Math.max(...keys.map((key,index)=>Math.ceil(String(entry[key]??'').length / Math.max(10,(sheet.columns[index].width||25)*0.85))));
    row.height = Math.min(409,Math.max(54,lines*18+12));
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = { name: 'Sakkal Majalla', size: 16, color: { argb: 'FF243447' } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'right',
        wrapText: true,
        readingOrder: 'rtl',
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: row.number % 2 === 0 ? 'FFF0F6FC' : 'FFFFFFFF' },
      };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFDCE5EF' } } };
      if (col === columns.length && link)
        cell.font = {
          name: 'Sakkal Majalla',
          size: 16,
          color: { argb: 'FF1565C0' },
          underline: true,
        };
      if (keys[col - 1] === 'خط العرض' || keys[col - 1] === 'خط الطول') cell.numFmt = '0.000000';
      if (keys[col - 1] === 'حالة البلاغ في المصدر')
        cell.font = {
          name: 'Sakkal Majalla',
          size: 16,
          bold: true,
          color: { argb: entry[keys[col - 1]] === 'تمت المعالجة' ? 'FF047857' : 'FF9A5800' },
        };
    });
  }
  const header = sheet.getRow(1);
  header.height = 48;
  header.eachCell((cell) => {
    cell.font = { name: 'Sakkal Majalla', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF182433' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
      readingOrder: 'rtl',
    };
  });
  sheet.headerFooter.oddHeader = '&Rالتعديات لإدارة المشاريع الرأسمالية';
  sheet.headerFooter.oddFooter = '&Rالصفحة &P من &N';
  return Buffer.from(await book.xlsx.writeBuffer());
}
