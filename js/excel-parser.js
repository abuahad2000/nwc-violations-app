/**
 * Excel Parser Module
 * Handles reading and parsing Excel/CSV files using SheetJS with robust Arabic column detection.
 */

class ExcelParser {
  /**
   * Parse an Excel/CSV file into normalized encroachment records
   * @param {File|ArrayBuffer} fileInput - Uploaded file or buffer
   * @returns {Promise<Array>} List of report objects
   */
  async parseFile(fileInput) {
    if (typeof XLSX === 'undefined') {
      throw new Error('مكتبة SheetJS (XLSX) غير متوفرة.');
    }

    let data;
    if (fileInput instanceof File) {
      data = await fileInput.arrayBuffer();
    } else {
      data = fileInput;
    }

    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert to 2D array of values
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd hh:mm:ss' });

    if (!rawRows || rawRows.length < 2) {
      throw new Error('الملف فارغ أو لا يحتوي على صفوف بيانات كافية.');
    }

    const headers = rawRows[0].map(h => (h ? String(h).trim() : ''));

    // Helper to find column index from multiple possible aliases
    const findCol = (...aliases) => {
      for (const alias of aliases) {
        for (let i = 0; i < headers.length; i++) {
          const cleanHeader = headers[i].replace(/\s+/g, ' ').trim();
          if (cleanHeader.includes(alias) || cleanHeader === alias) {
            return i;
          }
        }
      }
      return -1;
    };

    const idxId = findCol('رقم بلاغ التعدي', 'رقم البلاغ', 'البلاغ', 'ID', 'id');
    const idxDesc = findCol('وصف التعدي', 'الوصف', 'تفاصيل التعدي');
    const idxImpact = findCol('أثر التعدي', 'الاثر', 'الأثر', 'الضرر');
    const idxDate = findCol('تاريخ التعدي', 'تاريخ_التعدي');
    const idxLicense = findCol('رقم الرخصة', 'الرخصة', 'رقم_الرخصة');
    const idxReportDate = findCol('تاريخ البلاغ', 'تاريخ التسجيل', 'التاريخ');
    const idxOwner = findCol('الجهة المالكة', 'المالك');
    const idxOffender = findCol('الجهة المتعدية', 'المتعدي');
    const idxContractor = findCol('اسم المقاول', 'المقاول');
    const idxLng = findCol('خط الطول', 'خط_الطول', 'طول', 'lng', 'lon', 'longitude', 'X', 'x');
    const idxLat = findCol('خط العرض', 'خط_العرض', 'عرض', 'lat', 'latitude', 'Y', 'y');
    const idxStatus = findCol('حالة البلاغ', 'الحالة', 'حالة_البلاغ', 'status');
    const idxCity = findCol('المدينة', 'مدينة');
    const idxDistrict = findCol('الحي', 'حي', 'district');
    const idxStreet = findCol('الشارع', 'شارع', 'street');
    const idxComment = findCol('تعليق المركز', 'ملاحظات', 'تعليق');
    const idxChat = findCol('سجل المحادثات', 'المحادثات', 'سجل');

    if (idxLng === -1 || idxLat === -1) {
      throw new Error('لم يتم العثور على أعمدة الإحداثيات (خط الطول وخط العرض) في الملف.');
    }

    const reports = [];
    let skippedCount = 0;

    for (let r = 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;

      const getVal = (idx) => {
        if (idx !== -1 && idx < row.length && row[idx] !== undefined && row[idx] !== null) {
          return String(row[idx]).trim();
        }
        return '';
      };

      const rawLng = getVal(idxLng);
      const rawLat = getVal(idxLat);

      const lng = parseFloat(rawLng);
      const lat = parseFloat(rawLat);

      // Validate geographic coordinate bounds (Riyadh / Saudi coordinates rough check)
      if (isNaN(lng) || isNaN(lat) || lat < 10 || lat > 35 || lng < 30 || lng > 60) {
        skippedCount++;
        continue;
      }

      reports.push({
        id: getVal(idxId) || `REP-${r}`,
        description: getVal(idxDesc) || 'بلاغ تعدٍ بدون وصف',
        impact: getVal(idxImpact) || 'غير محدد',
        encroachmentDate: getVal(idxDate) || 'غير متوفر',
        licenseNumber: getVal(idxLicense) || 'لا يوجد',
        reportDate: getVal(idxReportDate) || '',
        ownerAgency: getVal(idxOwner) || 'أمانة منطقة الرياض',
        offenderAgency: getVal(idxOffender) || 'غير محدد',
        contractorName: getVal(idxContractor) || 'غير مسجل',
        lng: lng,
        lat: lat,
        status: getVal(idxStatus) || 'قيد المراجعة',
        city: getVal(idxCity) || 'الرياض',
        district: getVal(idxDistrict) || 'غير محدد',
        street: getVal(idxStreet) || 'غير محدد',
        centerComment: getVal(idxComment) || '',
        chatLog: getVal(idxChat) || ''
      });
    }

    console.log(`[ExcelParser] Successfully parsed ${reports.length} valid reports. Skipped: ${skippedCount}`);
    return reports;
  }

  /**
   * Load the pre-extracted default encroachments from data/default_encroachments.json
   */
  async loadDefaultReports() {
    try {
      console.log('[ExcelParser] Fetching data/default_encroachments.json...');
      const res = await fetch('data/default_encroachments.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log(`[ExcelParser] Loaded ${data.length} default encroachment records.`);
      return data;
    } catch (e) {
      console.warn('[ExcelParser] Error loading default reports:', e);
      return [];
    }
  }
}

window.ExcelParser = new ExcelParser();
