/**
 * KMZ Exporter Module
 * Generates and downloads standard .kmz files (zipped KML) for GIS & Google Earth.
 */

class KMZExporter {
  /**
   * Build KML XML string from an array of reports
   * @param {Array} reports
   * @param {string} documentName
   * @returns {string} KML XML
   */
  static buildKML(reports, documentName = 'بلاغات تعديات مشاريع المياه الوطنية') {
    const placemarks = reports.map(r => {
      const isSewer = r.sectorKey === 'sewer';
      const isProject = r.departmentKey === 'projects';
      const styleId = isSewer ? (isProject ? 'sewerProjStyle' : 'sewerMaintStyle') : (isProject ? 'waterProjStyle' : 'waterMaintStyle');

      const descHtml = `
        <![CDATA[
          <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; line-height: 1.5;">
            <h3 style="color: #007AFF; margin-bottom: 4px;">بلاغ رقم: ${r.id}</h3>
            <p><b>القطاع:</b> ${r.sector}</p>
            <p><b>التصنيف:</b> ${r.department}</p>
            <p><b>مدير البرنامج NWC:</b> ${r.programManager || 'غير مسند'}</p>
            <p><b>اسم المشروع:</b> ${r.matchedProject || ''}</p>
            <p><b>المقاول المنفذ:</b> ${r.contractorName || 'غير مسجل'}</p>
            <p><b>الحالة:</b> ${r.status}</p>
            <p><b>الحي والشارع:</b> ${r.district || ''} - ${r.street || ''}</p>
            <p><b>الوصف:</b> ${r.description || ''}</p>
            <p><b>الأثر:</b> ${r.impact || ''}</p>
            <p><b>الإحداثيات:</b> ${r.lat}, ${r.lng}</p>
          </div>
        ]]>
      `.trim();

      return `
    <Placemark>
      <name>${r.id} - ${r.contractorName || r.sector}</name>
      <description>${descHtml}</description>
      <styleUrl>#${styleId}</styleUrl>
      <Point>
        <coordinates>${r.lng},${r.lat},0</coordinates>
      </Point>
    </Placemark>
      `.trim();
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${documentName}</name>
    <open>1</open>
    
    <!-- Water Projects Style (Blue) -->
    <Style id="waterProjStyle">
      <IconStyle>
        <color>ffff7a00</color>
        <scale>1.2</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>
        </Icon>
      </IconStyle>
    </Style>

    <!-- Water Maintenance Style (Cyan) -->
    <Style id="waterMaintStyle">
      <IconStyle>
        <color>ffc7b030</color>
        <scale>1.0</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>
        </Icon>
      </IconStyle>
    </Style>

    <!-- Sewer Projects Style (Purple) -->
    <Style id="sewerProjStyle">
      <IconStyle>
        <color>ffd65658</color>
        <scale>1.2</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>
        </Icon>
      </IconStyle>
    </Style>

    <!-- Sewer Maintenance Style (Orange) -->
    <Style id="sewerMaintStyle">
      <IconStyle>
        <color>ff0095ff</color>
        <scale>1.0</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>
        </Icon>
      </IconStyle>
    </Style>

    <Folder>
      <name>البلاغات الميدانية</name>
${placemarks}
    </Folder>
  </Document>
</kml>`;
  }

  /**
   * Export given reports to a downloaded .kmz file
   * @param {Array} reports
   * @param {string} filename
   */
  static async exportToKMZ(reports, filename = 'تعديات_مشاريع_المياه_الوطنية.kmz') {
    if (typeof JSZip === 'undefined') {
      alert('مكتبة JSZip غير متوفرة لضغط ملف KMZ');
      return;
    }

    if (!reports || reports.length === 0) {
      alert('لا توجد بلاغات لتصديرها إلى KMZ');
      return;
    }

    const kmlText = this.buildKML(reports, filename.replace('.kmz', ''));
    const zip = new JSZip();
    zip.file('doc.kml', kmlText);

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    if (window.App) {
      window.App.showToast(`تم تصدير ${reports.length} بلاغ إلى ملف KMZ بنجاح`);
    }
  }

  /**
   * Export separate KMZ files for Water and Sewer
   * @param {Array} reports
   */
  static async exportDualKMZ(reports) {
    const waterReports = reports.filter(r => r.sectorKey === 'water');
    const sewerReports = reports.filter(r => r.sectorKey === 'sewer');
    const today = new Date().toISOString().slice(0, 10);

    if (waterReports.length > 0) {
      await this.exportToKMZ(waterReports, `تعديات_قطاع_المياه_${today}.kmz`);
    }
    if (sewerReports.length > 0) {
      await this.exportToKMZ(sewerReports, `تعديات_قطاع_الصرف_${today}.kmz`);
    }
  }
}

window.KMZExporter = KMZExporter;
