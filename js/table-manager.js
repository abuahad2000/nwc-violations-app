/**
 * Table Manager Module
 * Supports Dual-Classification filtering, Program Manager display,
 * Manager-Specific Excel Export, and Independent KMZ Export (Water / Sewer / All).
 */

class TableManager {
  constructor() {
    this.reports = [];
    this.filteredReports = [];
    this.currentPage = 1;
    this.pageSize = 15;
    this.sortColumn = 'id';
    this.sortDirection = 'asc';
    this.activeFilter = 'all'; // 'all' | 'water_projects' | 'water_maintenance' | 'sewer_projects' | 'sewer_maintenance'
    this.statusFilter = 'all';
    this.selectedManager = 'projects_all'; // from sidebar or dropdown
    this.searchQuery = '';

    this.initEvents();
  }

  initEvents() {
    const searchInput = document.getElementById('tableSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.currentPage = 1;
        this.applyFilters();
      });
    }

    const statusSelect = document.getElementById('tableStatusFilter');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.statusFilter = e.target.value;
        this.currentPage = 1;
        this.applyFilters();
      });
    }

    // Export Excel Button (Dedicated or Dual-sheet)
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if (exportExcelBtn) {
      exportExcelBtn.addEventListener('click', () => this.exportExcel());
    }

    // Export KMZ Buttons (Water, Sewer, All)
    const exportKmzBtn = document.getElementById('exportKmzBtn');
    if (exportKmzBtn) {
      exportKmzBtn.addEventListener('click', () => this.exportKMZ('all'));
    }

    const exportKmzWaterBtn = document.getElementById('exportKmzWaterBtn');
    if (exportKmzWaterBtn) {
      exportKmzWaterBtn.addEventListener('click', () => this.exportKMZ('water'));
    }

    const exportKmzSewerBtn = document.getElementById('exportKmzSewerBtn');
    if (exportKmzSewerBtn) {
      exportKmzSewerBtn.addEventListener('click', () => this.exportKMZ('sewer'));
    }
  }

  setData(reports) {
    this.reports = reports || [];
    this.currentPage = 1;
    this.populateStatusDropdown();
    this.applyFilters();
  }

  setFilter(filter) {
    this.activeFilter = filter;
    this.currentPage = 1;
    this.applyFilters();
  }

  setManagerFilter(managerKey) {
    this.selectedManager = managerKey;
    this.currentPage = 1;
    this.updateExportButtonLabels();
    this.applyFilters();
  }

  updateExportButtonLabels() {
    const btnText = document.getElementById('exportExcelBtnText');
    if (!btnText) return;

    if (this.selectedManager !== 'projects_all' && this.selectedManager !== 'maintenance_all' && this.selectedManager !== 'all') {
      btnText.textContent = `تصدير إكسل لمشاريع (${this.selectedManager})`;
    } else {
      btnText.textContent = 'تصدير إكسل (تبويبي المياه والصرف)';
    }
  }

  populateStatusDropdown() {
    const statusSelect = document.getElementById('tableStatusFilter');
    if (!statusSelect) return;

    const statuses = new Set();
    this.reports.forEach(r => {
      if (r.status) statuses.add(r.status.trim());
    });

    statusSelect.innerHTML = '<option value="all">جميع الحالات</option>';
    Array.from(statuses).sort().forEach(st => {
      const opt = document.createElement('option');
      opt.value = st;
      opt.textContent = st;
      statusSelect.appendChild(opt);
    });
  }

  applyFilters() {
    this.filteredReports = this.reports.filter(report => {
      // 1. Manager & Scope Filter (from sidebar)
      if (this.selectedManager === 'projects_all') {
        if (!report.isProjectContractor) return false;
      } else if (this.selectedManager === 'maintenance_all') {
        if (report.isProjectContractor) return false;
      } else if (this.selectedManager !== 'all') {
        if (report.programManager !== this.selectedManager) return false;
      }

      // 2. Dual Classification Filter
      if (this.activeFilter !== 'all') {
        if (this.activeFilter === 'water_projects' && (report.sectorKey !== 'water' || report.departmentKey !== 'projects')) return false;
        if (this.activeFilter === 'water_maintenance' && (report.sectorKey !== 'water' || report.departmentKey !== 'maintenance')) return false;
        if (this.activeFilter === 'sewer_projects' && (report.sectorKey !== 'sewer' || report.departmentKey !== 'projects')) return false;
        if (this.activeFilter === 'sewer_maintenance' && (report.sectorKey !== 'sewer' || report.departmentKey !== 'maintenance')) return false;
      }

      // 3. Status filter
      if (this.statusFilter !== 'all' && report.status.trim() !== this.statusFilter) {
        return false;
      }

      // 4. Search query
      if (this.searchQuery) {
        const text = `
          ${report.id} ${report.description} ${report.impact} ${report.contractorName} 
          ${report.offenderAgency} ${report.district} ${report.street} ${report.status} 
          ${report.matchedProject || ''} ${report.fullProjectTitle || ''} ${report.programManager || ''}
        `.toLowerCase();
        if (!text.includes(this.searchQuery)) {
          return false;
        }
      }

      return true;
    });

    // Sort
    this.filteredReports.sort((a, b) => {
      let valA = a[this.sortColumn] ?? '';
      let valB = b[this.sortColumn] ?? '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return this.sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      valA = String(valA);
      valB = String(valB);
      return this.sortDirection === 'asc' ? valA.localeCompare(valB, 'ar') : valB.localeCompare(valA, 'ar');
    });

    this.render();
  }

  render() {
    const tbody = document.getElementById('reportsTableBody');
    const infoEl = document.getElementById('tablePaginationInfo');
    const controlsEl = document.getElementById('tablePaginationControls');

    if (!tbody) return;

    const total = this.filteredReports.length;
    const startIdx = (this.currentPage - 1) * this.pageSize;
    const endIdx = Math.min(startIdx + this.pageSize, total);
    const pageReports = this.filteredReports.slice(startIdx, endIdx);

    if (pageReports.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 48px; color: var(--ios-text-tertiary);">
            <div style="font-size: 2rem; margin-bottom: 8px;">🔍</div>
            <div style="font-weight: 700;">لا توجد بلاغات مطابقة للمدير أو الفلتر المختار</div>
          </td>
        </tr>
      `;
      if (infoEl) infoEl.textContent = '0 من 0 بلاغ';
      if (controlsEl) controlsEl.innerHTML = '';
      return;
    }

    const rowsHtml = pageReports.map(r => {
      const isProject = r.departmentKey === 'projects';
      const isSewer = r.sectorKey === 'sewer';

      const sectorBadge = isSewer 
        ? `<span class="ios-kpi-badge badge-purple" style="background: rgba(175, 82, 222, 0.12); color: var(--ios-purple);">🚰 صرف</span>`
        : `<span class="ios-kpi-badge badge-blue">💧 مياه</span>`;

      const deptBadge = isProject
        ? `<span class="ios-kpi-badge badge-indigo">مشاريع</span>`
        : `<span class="ios-kpi-badge badge-orange">صيانة</span>`;

      const getStatusBadge = (st) => {
        st = (st || '').trim();
        if (st.includes('تمت المعالجة') || st.includes('منجز')) {
          return `<span class="ios-kpi-badge badge-green">✓ ${st}</span>`;
        }
        if (st.includes('معاد') || st.includes('مرفوض')) {
          return `<span class="ios-kpi-badge badge-red">✕ ${st}</span>`;
        }
        return `<span class="ios-kpi-badge badge-orange">⏳ ${st || 'تحت المعالجة'}</span>`;
      };

      return `
        <tr onclick="TableManager.onRowClick('${r.id}')">
          <td style="font-family: monospace; font-weight: 700; color: var(--ios-blue);">${r.id}</td>
          <td>
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              ${sectorBadge}
              ${deptBadge}
            </div>
          </td>
          <td>
            <div style="font-weight: 700; color: var(--ios-text-primary);">${r.programManager || 'غير مسند'}</div>
            <div style="font-size: 0.74rem; color: var(--ios-text-tertiary);">${r.subProgram || ''}</div>
          </td>
          <td style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.fullProjectTitle || r.matchedProject}">
            <div style="font-weight: 600; color: var(--ios-text-primary);">${r.matchedProject || 'مشروع معتمد'}</div>
            ${r.fullProjectTitle && r.fullProjectTitle !== r.matchedProject ? `<div style="font-size: 0.72rem; color: var(--ios-text-tertiary); overflow: hidden; text-overflow: ellipsis;">${r.fullProjectTitle}</div>` : ''}
          </td>
          <td style="font-weight: 600;">${r.district || 'غير محدد'} <span style="font-size: 0.74rem; color: var(--ios-text-tertiary);">(${r.street || 'شارع'})</span></td>
          <td><span style="font-weight: 600; color: var(--ios-blue);">${r.contractorName || r.offenderAgency || 'غير مسجل'}</span></td>
          <td>${getStatusBadge(r.status)}</td>
          <td>
            <button class="ios-btn ios-btn-secondary ios-btn-sm" onclick="event.stopPropagation(); TableManager.onRowClick('${r.id}')">
              عرض وتعديل
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml;

    if (infoEl) {
      infoEl.textContent = `عرض ${startIdx + 1} - ${endIdx} من إجمالي ${total} بلاغ`;
    }

    this.renderPagination(controlsEl, total);
  }

  renderPagination(container, total) {
    if (!container) return;

    const totalPages = Math.ceil(total / this.pageSize) || 1;
    let html = '';

    html += `
      <button class="ios-page-btn" ${this.currentPage <= 1 ? 'disabled' : ''} onclick="TableManager.goToPage(${this.currentPage - 1})">
        ❮
      </button>
    `;

    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    if (startPage > 1) {
      html += `<button class="ios-page-btn" onclick="TableManager.goToPage(1)">1</button>`;
      if (startPage > 2) html += `<span style="padding: 0 4px; color: var(--ios-text-tertiary);">...</span>`;
    }

    for (let p = startPage; p <= endPage; p++) {
      html += `
        <button class="ios-page-btn ${p === this.currentPage ? 'active' : ''}" onclick="TableManager.goToPage(${p})">
          ${p}
        </button>
      `;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) html += `<span style="padding: 0 4px; color: var(--ios-text-tertiary);">...</span>`;
      html += `<button class="ios-page-btn" onclick="TableManager.goToPage(${totalPages})">${totalPages}</button>`;
    }

    html += `
      <button class="ios-page-btn ${this.currentPage >= totalPages ? 'disabled' : ''} onclick="TableManager.goToPage(${this.currentPage + 1})">
        ❯
      </button>
    `;

    container.innerHTML = html;
  }

  static goToPage(page) {
    if (window.TableManagerInstance) {
      window.TableManagerInstance.currentPage = page;
      window.TableManagerInstance.render();
    }
  }

  static onRowClick(reportId) {
    if (!window.TableManagerInstance) return;
    const report = window.TableManagerInstance.reports.find(r => String(r.id) === String(reportId));
    if (report) {
      if (window.MapManager) {
        window.MapManager.focusReport(report);
      }
      if (window.ActionSheetInstance) {
        window.ActionSheetInstance.open(report);
      }
    }
  }

  /**
   * Export to Excel: Dedicated Manager workbook OR Dual-sheet Water & Sewer
   */
  exportExcel() {
    if (typeof XLSX === 'undefined') {
      alert('مكتبة SheetJS غير متوفرة');
      return;
    }

    const reportsToExport = this.filteredReports.length > 0 ? this.filteredReports : this.reports;
    if (reportsToExport.length === 0) {
      alert('لا توجد بيانات متاحة للتصدير');
      return;
    }

    const mapReportToRow = (r, idx) => ({
      'م': idx + 1,
      'رقم البلاغ': r.id,
      'القطاع': r.sector,
      'التصنيف المكاني': r.department,
      'مدير البرنامج NWC': r.programManager || 'غير مسند',
      'البرنامج الفرعي': r.subProgram || '',
      'اسم المشروع المعتمد': r.matchedProject || '',
      'بيانات العقد المعتمد': r.fullProjectTitle || r.matchedProject || '',
      'حالة البلاغ': r.status,
      'الحي': r.district,
      'الشارع': r.street,
      'اسم المقاول المنفذ': r.contractorName,
      'الجهة المتعدية': r.offenderAgency,
      'وصف التعدي': r.description,
      'أثر التعدي': r.impact,
      'خط العرض': r.lat,
      'خط الطول': r.lng,
      'رقم الرخصة': r.licenseNumber,
      'تاريخ البلاغ': r.reportDate || r.encroachmentDate,
      'تعليق المركز': r.centerComment
    });

    const wb = XLSX.utils.book_new();
    const today = new Date().toISOString().slice(0, 10);

    // Case 1: Specific Manager Selected
    if (this.selectedManager !== 'projects_all' && this.selectedManager !== 'maintenance_all' && this.selectedManager !== 'all') {
      const mgrReports = reportsToExport.map(mapReportToRow);
      const wsReports = XLSX.utils.json_to_sheet(mgrReports);
      XLSX.utils.book_append_sheet(wb, wsReports, `بلاغات ${this.selectedManager}`.slice(0, 31));

      // Sheet 2: Official Projects of this manager
      const mgrProjects = window.SpatialEngine.getProjectsForManager(this.selectedManager).map((p, idx) => ({
        'م': idx + 1,
        'اسم المشروع': p.projectName,
        'المقاول المنفذ': p.contractor,
        'مدير البرنامج': p.manager,
        'النطاق الجغرافي / الحي': p.districtScope,
        'القطاع': p.sector,
        'الصيغة المعتمدة': p.fullTitle
      }));
      const wsProjects = XLSX.utils.json_to_sheet(mgrProjects);
      XLSX.utils.book_append_sheet(wb, wsProjects, 'المشاريع والعقود المعتمدة');

      XLSX.writeFile(wb, `تعديات_مشاريع_${this.selectedManager}_${today}.xlsx`);
      if (window.App) {
        window.App.showToast(`تم تصدير ملف إكسل مخصص لـ [${this.selectedManager}] بإجمالي ${mgrReports.length} بلاغ`);
      }
      return;
    }

    // Case 2: Overall Project Contractors / All reports (Dual Sheet + Managers Summary)
    const waterReports = reportsToExport.filter(r => r.sectorKey === 'water').map(mapReportToRow);
    const sewerReports = reportsToExport.filter(r => r.sectorKey === 'sewer').map(mapReportToRow);

    const wsWater = XLSX.utils.json_to_sheet(waterReports);
    XLSX.utils.book_append_sheet(wb, wsWater, 'المياه');

    const wsSewer = XLSX.utils.json_to_sheet(sewerReports);
    XLSX.utils.book_append_sheet(wb, wsSewer, 'الصرف');

    // Sheet 3: 10 Program Managers & 97 Projects Registry Summary
    if (window.SpatialEngine && window.SpatialEngine.projects && window.SpatialEngine.projects.length > 0) {
      const allProjects = window.SpatialEngine.projects.map((p, idx) => ({
        'م': idx + 1,
        'اسم المشروع': p.projectName,
        'المقاول المنفذ': p.contractor,
        'مدير البرنامج': p.manager,
        'النطاق الجغرافي': p.districtScope,
        'القطاع': p.sector,
        'الصيغة المعتمدة': p.fullTitle
      }));
      const wsAllProjects = XLSX.utils.json_to_sheet(allProjects);
      XLSX.utils.book_append_sheet(wb, wsAllProjects, 'سجل المشاريع الـ 97 المعتمدة');
    }

    XLSX.writeFile(wb, `تعديات_مقاولي_مشاريع_المياه_الوطنية_${today}.xlsx`);

    if (window.App) {
      window.App.showToast(`تم تصدير ملف Excel بتبويبي [المياه: ${waterReports.length}] و [الصرف: ${sewerReports.length}]`);
    }
  }

  /**
   * Export to KMZ with sector filter: 'all' | 'water' | 'sewer'
   */
  exportKMZ(sectorFilter = 'all') {
    let reportsToExport = this.filteredReports.length > 0 ? this.filteredReports : this.reports;
    if (reportsToExport.length === 0) {
      alert('لا توجد بيانات متاحة للتصدير');
      return;
    }

    let filename = '';
    const today = new Date().toISOString().slice(0, 10);
    const mgrSuffix = (this.selectedManager !== 'projects_all' && this.selectedManager !== 'all') ? `_${this.selectedManager}` : '';

    if (sectorFilter === 'water') {
      reportsToExport = reportsToExport.filter(r => r.sectorKey === 'water');
      filename = `تعديات_مشاريع_المياه${mgrSuffix}_${today}.kmz`;
    } else if (sectorFilter === 'sewer') {
      reportsToExport = reportsToExport.filter(r => r.sectorKey === 'sewer');
      filename = `تعديات_مشاريع_الصرف${mgrSuffix}_${today}.kmz`;
    } else {
      filename = `تعديات_مشاريع_المياه_والصرف${mgrSuffix}_${today}.kmz`;
    }

    if (reportsToExport.length === 0) {
      alert(`لا توجد بلاغات تابعة لقطاع ${sectorFilter === 'water' ? 'المياه' : 'الصرف'} للتصدير`);
      return;
    }

    window.KMZExporter.exportToKMZ(reportsToExport, filename, sectorFilter);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.TableManagerInstance = new TableManager();
});
