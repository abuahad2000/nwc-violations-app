import * as XLSX from 'xlsx';
import yauzl from 'yauzl';
import crypto from 'crypto';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export async function validateWorkbook(buffer: Buffer) {
  if (!buffer.length || buffer.length > MAX_FILE_BYTES || buffer.readUInt16LE(0) !== 0x4b50)
    throw new Error('يلزم ملف XLSX صالح لا يتجاوز 10MB');
  await new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) return reject(new Error('ملف مضغوط غير صالح'));
      let total = 0;
      let count = 0;
      let actual = 0;
      zip.on('error', reject);
      zip.on('entry', (entry: yauzl.Entry) => {
        total += entry.uncompressedSize;
        count++;
        if (
          total > 60 * 1024 * 1024 ||
          count > 2000 ||
          entry.uncompressedSize > 30 * 1024 * 1024 ||
          entry.fileName.includes('..') ||
          /externalLinks|vbaProject/i.test(entry.fileName)
        ) {
          zip.close();
          reject(new Error('بنية الملف أو حجمه بعد الفك غير مسموح'));
          return;
        }
        if (entry.fileName.endsWith('/')) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            zip.close();
            reject(new Error('تعذر فحص محتويات الملف'));
            return;
          }
          stream.on('error', reject);
          stream.on('data', (chunk: Buffer) => {
            actual += chunk.length;
            if (actual > 60 * 1024 * 1024) {
              stream.destroy();
              zip.close();
              reject(new Error('تجاوز الحجم الفعلي بعد الفك'));
            }
          });
          stream.on('end', () => zip.readEntry());
        });
      });
      zip.on('end', resolve);
      zip.readEntry();
    });
  });
}
const text = (value: unknown) => String(value ?? '').trim();
export function parseSourceDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value);
    return d && d.y >= 1900 && d.y < 2200
      ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
      : null;
  }
  const v = text(value);
  const match =
    v.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/) || v.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  return Number.isFinite(Date.parse(iso)) && new Date(iso).toISOString().slice(0, 10) === iso
    ? iso
    : null;
}
export function normalizeSource(row: Record<string, unknown>) {
  const lat = text(row['خط العرض']);
  const lng = text(row['خط الطول']);
  return {
    source_reference: text(row['رقم بلاغ التعدي']),
    reported_contractor_name: text(row['اسم المقاول']) || null,
    latitude: lat && Number.isFinite(Number(lat)) ? Number(lat) : null,
    longitude: lng && Number.isFinite(Number(lng)) ? Number(lng) : null,
    source_status: text(row['حالة البلاغ']) || 'غير محدد',
    reported_date: parseSourceDate(row['تاريخ البلاغ']),
    incident_date: parseSourceDate(row['تاريخ التعدي']),
    description_raw: text(row['وصف التعدي']) || null,
    district_raw: text(row['الحي']) || null,
    street_raw: text(row['الشارع']) || null,
    city_raw: text(row['المدينة']) || null,
    is_closed: ['تمت المعالجة', 'معالج', 'مغلق'].includes(text(row['حالة البلاغ'])) ? 1 : 0,
  };
}
export async function readWorkbook(buffer: Buffer) {
  await validateWorkbook(buffer);
  const wb = XLSX.read(buffer, {
    type: 'buffer',
    cellFormula: false,
    cellHTML: false,
    sheetRows: 10002,
  });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  if (!rows.length || rows.length > 10000) throw new Error('يلزم 1 إلى 10000 سجل في الدفعة');
  if (!('رقم بلاغ التعدي' in rows[0]) || !('حالة البلاغ' in rows[0]))
    throw new Error('يلزم عمود رقم بلاغ التعدي وعمود حالة البلاغ في الورقة الأولى');
  const seen = new Set<string>();
  const records = rows.map((raw, index) => {
    const normalized = normalizeSource(raw);
    if (
      !normalized.source_reference ||
      normalized.source_reference.length > 100 ||
      seen.has(normalized.source_reference)
    )
      throw new Error(`رقم البلاغ مفقود أو مكرر في الصف ${index + 2}`);
    seen.add(normalized.source_reference);
    if (Object.values(raw).some((v) => typeof v === 'string' && v.length > 50000))
      throw new Error(`نص أطول من الحد المسموح في الصف ${index + 2}`);
    return { raw, normalized, row: index + 2 };
  });
  return {
    records,
    file_hash: crypto.createHash('sha256').update(buffer).digest('hex'),
    sheet: wb.SheetNames[0],
  };
}
