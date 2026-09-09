/**
 * Program Managers Dashboard Module
 * Executive view for Program Managers with dedicated KPI cards, project scopes, and action tracking.
 */

class ManagersDashboard {
  constructor() {
    this.reports = [];
    this.managersMap = {};
    this.selectedManager = 'all';
    this.projectRegistry = [];

    this.initEvents();
  }

  initEvents() {
    const select = document.getElementById('mgrSelect');
    if (select) {
      select.addEventListener('change', (e) => {
        this.selectManager(e.target.value);
      });
    }

    const searchInput = document.getElementById('mgrReportSearch');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.renderReportsTable();
      });
    }

    const statusFilter = document.getElementById('mgrReportStatusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', () => {
        this.renderReportsTable();
      });
    }
  }

  /**
   * Set raw classified data and registry
   * @param {Array} reports 
   * @param {Object} kpis 
   */
  setData(reports, kpis) {
    this.reports = reports || [];
    this.managersMap = kpis.managersBreakdown || {};
    this.populateManagerSelector();
    this.render();
  }

  /**
   * Populate manager selector options
   */
  populateManagerSelector() {
    const select = document.getElementById('mgrSelect');
    if (!select) return;

    const current = select.value || 'all';
    select.innerHTML = '<option value="all">👑 نظرة عامة شاملة (كافة مديري البرامج)</option>';

    const sortedManagers = Object.keys(this.managersMap).sort((a, b) => {
      return this.managersMap[b].total - this.managersMap[a].total;
    });

    sortedManagers.forEach(name => {
      const data = this.managersMap[name];
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = `👤 ${name} (${data.total.toLocaleString('ar-SA')} بلاغ)`;
      select.appendChild(opt);
    });

    select.value = current;
  }

  /**
   * Switch active manager
   * @param {string} managerName 
   */
  selectManager(managerName) {
    this.selectedManager = managerName;
    this.render();
  }

  /**
   * Render Manager Dashboard UI
   */
  render() {
    this.renderKPIs();
    this.renderManagerHeader();
    this.renderReportsTable();
  }

  /**
   * Render Manager-specific or Global Header
   */
  renderManagerHeader() {
    const headerEl = document.getElementById('mgrProfileHeader');
    if (!headerEl) return;

    if (this.selectedManager === 'all') {
      const mgrCount = Object.keys(this.managersMap).length;
      headerEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="width: 52px; height: 52px; border-radius: 16px; background: rgba(0, 122, 255, 0.12); color: var(--ios-blue); display: flex; align-items: center; justify-content: center; font-size: 1.6rem;">
            👔
          </div>
          <div>
            <h2 style="font-size: 1.3rem; font-weight: 800; color: var(--ios-text-primary);">لوحة المتابعة التنفيذية لمديري البرامج</h2>
            <p style="font-size: 0.85rem; color: var(--ios-text-secondary); margin-top: 2px;">
              توزيع وإسناد بلاغات التعديات على ${mgrCount} من مديري البرامج والبرامج الفرعية في الرياض
            </p>
          </div>
        </div>
      `;
      return;
    }

    const data = this.managersMap[this.selectedManager];
    if (!data) return;

    const subProgramsText = data.subPrograms.join(' • ') || 'قطاع مشاريع المياه والصرف الصحي';

    headerEl.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="width: 52px; height: 52px; border-radius: 16px; background: linear-gradient(135deg, var(--ios-blue), var(--ios-indigo)); color: #FFF; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; box-shadow: 0 4px 14px rgba(var(--ios-blue-rgb), 0.3);">
            👤
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--ios-text-primary);">${data.name}</h2>
              <span class="ios-kpi-badge badge-blue">مدير برنامج NWC</span>
            </div>
            <p style="font-size: 0.86rem; color: var(--ios-text-secondary); margin-top: 2px; font-weight: 600;">
              البرنامج الإشرافي: <span style="color: var(--ios-blue);">${subProgramsText}</span>
            </p>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 10px;">
          <button class="ios-btn ios-btn-secondary ios-btn-sm" onclick="ManagersDashboard.exportManagerReports('${data.name}')">
            📥 تصدير بلاغات ${data.name}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render Manager KPIs
   */
  renderKPIs() {
    const kpiGrid = document.getElementById('mgrKpiGrid');
    if (!kpiGrid) return;

    let total = 0, open = 0, resolved = 0, rate = '0.0%', projects = 0, maintenance = 0, water = 0, sewer = 0;

    if (this.selectedManager === 'all') {
      Object.values(this.managersMap).forEach(m => {
        total += m.total;
        open += m.open;
        resolved += m.resolved;
        projects += m.projects;
        maintenance += m.maintenance;
        water += m.water;
        sewer += m.sewer;
      });
      rate = total > 0 ? ((resolved / total) * 100).toFixed(1) + '%' : '0.0%';
    } else {
      const m = this.managersMap[this.selectedManager] || {};
      total = m.total || 0;
      open = m.open || 0;
      resolved = m.resolved || 0;
      rate = m.resolutionRate || '0.0%';
      projects = m.projects || 0;
      maintenance = m.maintenance || 0;
      water = m.water || 0;
      sewer = m.sewer || 0;
    }

    kpiGrid.innerHTML = `
      <!-- Total Assigned -->
      <div class="ios-glass ios-kpi-card ios-kpi-total">
        <div class="ios-kpi-header">
          <span class="ios-kpi-title">إجمالي البلاغات المسندة</span>
          <div class="ios-kpi-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
        </div>
        <div class="ios-kpi-value">${total.toLocaleString('ar-SA')}</div>
        <div class="ios-kpi-footer">
          <span>شامل كافة القطاعات</span>
          <span class="ios-kpi-badge badge-blue">مسند بالنظام</span>
        </div>
      </div>

      <!-- Open / Pending -->
      <div class="ios-glass ios-kpi-card" style="position: relative;">
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; border-radius: 20px 20px 0 0; background: var(--ios-red);"></div>
        <div class="ios-kpi-header">
          <span class="ios-kpi-title">البلاغات المعلقة / قيد الإجراء</span>
          <div class="ios-kpi-icon-wrap" style="background: rgba(255, 59, 48, 0.12); color: var(--ios-red);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
        </div>
        <div class="ios-kpi-value" style="color: var(--ios-red);">${open.toLocaleString('ar-SA')}</div>
        <div class="ios-kpi-footer">
          <span>تتطلب متابعة ميدانية عاجلة</span>
          <span class="ios-kpi-badge badge-red">مفتوحة</span>
        </div>
      </div>

      <!-- Resolved -->
      <div class="ios-glass ios-kpi-card ios-kpi-resolved">
        <div class="ios-kpi-header">
          <span class="ios-kpi-title">البلاغات المنجزة والمعالجة</span>
          <div class="ios-kpi-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
        </div>
        <div class="ios-kpi-value" style="color: var(--ios-green);">${resolved.toLocaleString('ar-SA')}</div>
        <div class="ios-kpi-footer">
          <span>نسبة الإنجاز: ${rate}</span>
          <span class="ios-kpi-badge badge-green">تمت المعالجة</span>
        </div>
      </div>

      <!-- Scope Breakdown (Projects vs Maint | Water vs Sewer) -->
      <div class="ios-glass ios-kpi-card" style="position: relative;">
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; border-radius: 20px 20px 0 0; background: var(--ios-purple);"></div>
        <div class="ios-kpi-header">
          <span class="ios-kpi-title">توزيع النطاقات والقطاعات</span>
          <div class="ios-kpi-icon-wrap" style="background: rgba(175, 82, 222, 0.12); color: var(--ios-purple);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.86rem; font-weight: 700;">
            <span style="color: var(--ios-indigo);">🏗️ مشاريع: ${projects.toLocaleString('ar-SA')}</span>
            <span style="color: var(--ios-orange);">🔧 صيانة: ${maintenance.toLocaleString('ar-SA')}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.86rem; font-weight: 700;">
            <span style="color: var(--ios-blue);">💧 مياه: ${water.toLocaleString('ar-SA')}</span>
            <span style="color: var(--ios-purple);">🚰 صرف: ${sewer.toLocaleString('ar-SA')}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render Manager's filtered reports table
   */
  renderReportsTable() {
    const tbody = document.getElementById('mgrReportsTableBody');
    if (!tbody) return;

    const query = (document.getElementById('mgrReportSearch')?.value || '').trim().toLowerCase();
    const statusVal = document.getElementById('mgrReportStatusFilter')?.value || 'all';

    let list = this.reports;
    if (this.selectedManager !== 'all') {
      list = list.filter(r => r.programManager === this.selectedManager);
    }

    if (statusVal !== 'all') {
      list = list.filter(r => (r.status || '').trim() === statusVal);
    }

    if (query) {
      list = list.filter(r => {
        const text = `${r.id} ${r.description} ${r.contractorName} ${r.district} ${r.matchedProject || ''}`.toLowerCase();
        return text.includes(query);
      });
    }

    const countEl = document.getElementById('mgrReportCountText');
    if (countEl) {
      countEl.textContent = `عرض ${list.length.toLocaleString('ar-SA')} بلاغ تابع للمدير`;
    }

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 36px; color: var(--ios-text-tertiary);">
            <div>🔍 لا توجد بلاغات مسندة تطابق البحث</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list.slice(0, 50).map(r => {
      const isSewer = r.sectorKey === 'sewer';
      const isProj = r.departmentKey === 'projects';

      const sectorBadge = isSewer 
        ? `<span class="ios-kpi-badge badge-purple" style="background: rgba(175, 82, 222, 0.12); color: var(--ios-purple);">🚰 صرف</span>`
        : `<span class="ios-kpi-badge badge-blue">💧 مياه</span>`;

      const deptBadge = isProj
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
        return `<span class="ios-kpi-badge badge-orange">⏳ ${st || 'قيد المتابعة'}</span>`;
      };

      return `
        <tr onclick="ManagersDashboard.onRowClick('${r.id}')" style="cursor: pointer;">
          <td style="font-family: monospace; font-weight: 700; color: var(--ios-blue);">${r.id}</td>
          <td>
            <div style="display: flex; gap: 4px;">
              ${sectorBadge}
              ${deptBadge}
            </div>
          </td>
          <td style="font-weight: 700; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.matchedProject || ''}">
            ${r.matchedProject || 'نطاق أعمال عام'}
          </td>
          <td>${r.contractorName || r.offenderAgency || 'غير مسجل'}</td>
          <td>${r.district || 'غير محدد'}</td>
          <td>${getStatusBadge(r.status)}</td>
          <td>
            <button class="ios-btn ios-btn-secondary ios-btn-sm" onclick="event.stopPropagation(); ManagersDashboard.onRowClick('${r.id}')">
              بطاقة البلاغ
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  static onRowClick(reportId) {
    if (!window.ManagersDashboardInstance) return;
    const report = window.ManagersDashboardInstance.reports.find(r => String(r.id) === String(reportId));
    if (report && window.ActionSheetInstance) {
      window.ActionSheetInstance.open(report);
    }
  }

  static exportManagerReports(managerName) {
    if (typeof XLSX === 'undefined') {
      alert('مكتبة SheetJS غير متوفرة');
      return;
    }

    const reports = window.ManagersDashboardInstance.reports.filter(r => r.programManager === managerName);
    if (reports.length === 0) {
      alert('لا توجد بلاغات لهذا المدير');
      return;
    }

    const rows = reports.map((r, i) => ({
      'م': i + 1,
      'رقم البلاغ': r.id,
      'مدير البرنامج': r.programManager,
      'اسم المشروع': r.matchedProject,
      'القطاع': r.sector,
      'التصنيف المكاني': r.department,
      'حالة البلاغ': r.status,
      'الحي': r.district,
      'المقاول': r.contractorName,
      'الوصف': r.description,
      'الأثر': r.impact,
      'الإحداثيات': `${r.lat}, ${r.lng}`
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'بلاغات_المدير');
    XLSX.writeFile(wb, `بلاغات_${managerName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);

    if (window.App) {
      window.App.showToast(`تم تصدير ${rows.length} بلاغ لـ ${managerName}`);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.ManagersDashboardInstance = new ManagersDashboard();
});
