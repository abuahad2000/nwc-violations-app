/**
 * iOS Action Sheet Module with In-Place Manual Editing
 * Supports dynamic project selection based on the 10 official managers
 * and direct manual reassignment with localStorage persistence.
 */

class ActionSheet {
  constructor() {
    this.backdrop = document.getElementById('actionSheetBackdrop');
    this.sheet = document.getElementById('actionSheet');
    this.currentReport = null;
    this.isEditMode = false;
    this.initEvents();
  }

  initEvents() {
    if (!this.backdrop || !this.sheet) return;

    this.backdrop.addEventListener('click', () => this.close());

    const closeBtn = document.getElementById('sheetCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.sheet.classList.contains('active')) {
        this.close();
      }
    });

    let startY = 0;
    const handle = document.getElementById('sheetHandle');
    if (handle) {
      handle.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
      }, { passive: true });

      handle.addEventListener('touchmove', (e) => {
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        if (diff > 50) {
          this.close();
        }
      }, { passive: true });
    }
  }

  open(report) {
    if (!report) return;
    this.currentReport = report;
    this.isEditMode = false;
    this.render();

    this.backdrop.classList.add('active');
    this.sheet.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  close() {
    if (this.backdrop) this.backdrop.classList.remove('active');
    if (this.sheet) this.sheet.classList.remove('active');
    document.body.style.overflow = '';
    this.isEditMode = false;
  }

  render() {
    const report = this.currentReport;
    if (!report) return;

    // Header
    const titleEl = document.getElementById('sheetReportId');
    const subtitleEl = document.getElementById('sheetReportDept');

    if (titleEl) {
      titleEl.textContent = `بلاغ رقم: ${report.id}`;
    }

    const isProject = report.departmentKey === 'projects';
    const isSewer = report.sectorKey === 'sewer';

    const sectorBadge = isSewer 
      ? `<span class="ios-kpi-badge badge-purple" style="background: rgba(175, 82, 222, 0.14); color: var(--ios-purple);">🚰 قطاع الصرف الصحي</span>`
      : `<span class="ios-kpi-badge badge-blue">💧 قطاع شبكات المياه</span>`;

    const deptBadge = isProject
      ? `<span class="ios-kpi-badge badge-indigo">🏗️ مشاريع</span>`
      : `<span class="ios-kpi-badge badge-orange">🔧 صيانة</span>`;

    if (subtitleEl) {
      subtitleEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          ${sectorBadge}
          ${deptBadge}
          <span style="font-size: 0.82rem; color: var(--ios-text-secondary); font-weight: 600;">
            ${report.programManager ? `مسؤولية: ${report.programManager}` : ''}
          </span>
        </div>
      `;
    }

    if (this.isEditMode) {
      this.renderEditForm();
    } else {
      this.renderDetailsView();
    }
  }

  renderDetailsView() {
    const report = this.currentReport;
    const body = document.getElementById('sheetDetailsBody');
    const actions = document.getElementById('sheetActionButtons');

    if (body) {
      const getStatusBadge = (st) => {
        st = (st || '').trim();
        if (st.includes('تمت المعالجة') || st.includes('منجز')) {
          return `<span class="ios-kpi-badge badge-green">✓ ${st}</span>`;
        }
        if (st.includes('معاد') || st.includes('مرفوض')) {
          return `<span class="ios-kpi-badge badge-red">✕ ${st}</span>`;
        }
        return `<span class="ios-kpi-badge badge-orange">⏳ ${st || 'تحت معالجة المقاول'}</span>`;
      };

      body.innerHTML = `
        <!-- Program Manager & Project Scope Banner -->
        <div class="ios-glass-subtle" style="padding: 14px 18px; border-right: 4px solid var(--ios-blue); display: flex; flex-direction: column; gap: 6px;">
          <div style="font-size: 0.76rem; font-weight: 700; color: var(--ios-blue); text-transform: uppercase;">
            الجهة والمدير المسؤول NWC
          </div>
          <div style="font-size: 1.05rem; font-weight: 800; color: var(--ios-text-primary);">
            ${report.programManager || 'إدارة الصيانة العامة'}
          </div>
          <div style="font-size: 0.84rem; color: var(--ios-text-secondary); font-weight: 600;">
            ${report.subProgram || 'أعمال شبكات المياه والصرف'}
          </div>
        </div>

        <!-- Approved Project Banner -->
        <div class="ios-glass-subtle" style="padding: 14px 18px; border-right: 4px solid var(--ios-indigo); display: flex; flex-direction: column; gap: 6px;">
          <div style="font-size: 0.76rem; font-weight: 700; color: var(--ios-indigo);">
            المشروع المعتمد من القائمة الحصرية:
          </div>
          <div style="font-size: 0.94rem; font-weight: 700; color: var(--ios-text-primary);">
            ${report.matchedProject || 'نطاق مشاريع عام'}
          </div>
          ${report.fullProjectTitle && report.fullProjectTitle !== report.matchedProject ? `
            <div style="font-size: 0.78rem; color: var(--ios-text-tertiary); line-height: 1.4;">
              ${report.fullProjectTitle}
            </div>
          ` : ''}
        </div>

        <!-- 2x2 Details Grid -->
        <div class="ios-details-grid">
          <div class="ios-detail-box">
            <div class="ios-detail-label">حالة البلاغ الحالية</div>
            <div class="ios-detail-value">${getStatusBadge(report.status)}</div>
          </div>

          <div class="ios-detail-box">
            <div class="ios-detail-label">المقاول المنفذ للمشروع</div>
            <div class="ios-detail-value" style="color: var(--ios-blue);">${report.contractorName || 'غير مسجل'}</div>
          </div>

          <div class="ios-detail-box">
            <div class="ios-detail-label">الحي والشارع</div>
            <div class="ios-detail-value">${report.district || 'غير محدد'} - ${report.street || 'شارع فرعي'}</div>
          </div>

          <div class="ios-detail-box">
            <div class="ios-detail-label">الجهة المتعدية</div>
            <div class="ios-detail-value" style="color: var(--ios-red);">${report.offenderAgency || 'غير محدد'}</div>
          </div>

          <div class="ios-detail-box">
            <div class="ios-detail-label">رقم الرخصة</div>
            <div class="ios-detail-value" style="font-family: monospace;">${report.licenseNumber || 'بدون رخصة'}</div>
          </div>

          <div class="ios-detail-box">
            <div class="ios-detail-label">تاريخ البلاغ</div>
            <div class="ios-detail-value">${report.reportDate || report.encroachmentDate || 'غير مسجل'}</div>
          </div>
        </div>

        <!-- Description Box -->
        <div class="ios-detail-box" style="background: rgba(255, 255, 255, 0.85);">
          <div class="ios-detail-label">تفاصيل ووصف التعدي الميداني</div>
          <div class="ios-detail-value" style="font-weight: 500; font-size: 0.92rem; line-height: 1.6;">
            ${report.description || 'لا يوجد وصف'}
          </div>
        </div>

        <!-- Impact Box -->
        <div class="ios-detail-box" style="background: rgba(255, 255, 255, 0.85);">
          <div class="ios-detail-label">أثر التعدي والضرر</div>
          <div class="ios-detail-value" style="font-weight: 500; font-size: 0.92rem; line-height: 1.6; color: var(--ios-red);">
            ${report.impact || 'لا يوجد تسجيل للأثر'}
          </div>
        </div>
      `;
    }

    if (actions) {
      actions.innerHTML = `
        <button class="ios-btn ios-btn-primary" onclick="ActionSheet.enableEditMode()">
          ✏️ تعديل بيانات البلاغ والمشروع يدوياً
        </button>
        <a href="https://maps.apple.com/?q=${report.lat},${report.lng}" target="_blank" class="ios-btn ios-btn-secondary">
          🗺️ أبل
        </a>
        <a href="https://www.google.com/maps?q=${report.lat},${report.lng}" target="_blank" class="ios-btn ios-btn-secondary">
          🌐 جوجل
        </a>
      `;
    }
  }

  renderEditForm() {
    const report = this.currentReport;
    const body = document.getElementById('sheetDetailsBody');
    const actions = document.getElementById('sheetActionButtons');

    const managers = window.SpatialEngine.OFFICIAL_MANAGERS;
    const currentMgr = report.programManager || managers[0].name;

    let managerOptions = managers.map(m => `
      <option value="${m.name}" ${currentMgr === m.name ? 'selected' : ''}>
        👤 ${m.name} (${m.role})
      </option>
    `).join('');
    managerOptions += `<option value="إدارة الصيانة العامة" ${currentMgr === 'إدارة الصيانة العامة' ? 'selected' : ''}>🔧 إدارة الصيانة العامة (خارج المشاريع)</option>`;

    // Get projects for current manager
    const mgrProjects = window.SpatialEngine.getProjectsForManager(currentMgr);
    let projectOptions = '<option value="">-- اختر المشروع من القائمة المعتمدة --</option>';
    mgrProjects.forEach(p => {
      const isSel = (report.matchedProject === p.projectName || report.fullProjectTitle === p.fullTitle) ? 'selected' : '';
      projectOptions += `<option value="${p.projectName}" data-full="${p.fullTitle}" data-contractor="${p.contractor}" ${isSel}>${p.projectName} [${p.contractor}] - (${p.districtScope})</option>`;
    });

    if (body) {
      body.innerHTML = `
        <div class="ios-glass-subtle" style="padding: 20px; border: 1.5px solid var(--ios-blue); display: flex; flex-direction: column; gap: 18px; border-radius: 16px;">
          <div style="font-weight: 800; font-size: 1.05rem; color: var(--ios-blue); display: flex; align-items: center; gap: 8px;">
            <span>✏️</span>
            <span>تعديل تصنيف ومسؤولية البلاغ #${report.id}</span>
          </div>

          <!-- Select Manager -->
          <div>
            <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--ios-text-secondary); margin-bottom: 6px;">
              مدير البرنامج المسؤول (NWC):
            </label>
            <select id="editManagerSelect" class="ios-filter-select" style="width: 100%; padding: 12px; font-weight: 700;" onchange="ActionSheet.onManagerChange(this.value)">
              ${managerOptions}
            </select>
          </div>

          <!-- Select Project Name -->
          <div>
            <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--ios-text-secondary); margin-bottom: 6px;">
              المشروع المعتمد للمدير المختار:
            </label>
            <select id="editProjectSelect" class="ios-filter-select" style="width: 100%; padding: 12px; margin-bottom: 8px;" onchange="ActionSheet.onProjectSelectChange(this)">
              ${projectOptions}
            </select>
            <input type="text" id="editProjectManualInput" class="ios-search-input" 
                   value="${report.matchedProject || ''}" placeholder="أو اكتب اسم المشروع يدوياً هنا...">
          </div>

          <!-- Status -->
          <div>
            <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--ios-text-secondary); margin-bottom: 6px;">
              حالة البلاغ:
            </label>
            <select id="editStatusSelect" class="ios-filter-select" style="width: 100%; padding: 10px;">
              <option value="تمت المعالجة" ${report.status.includes('تمت المعالجة') ? 'selected' : ''}>✓ تمت المعالجة (منجز)</option>
              <option value="تحت معالجة المقاول" ${report.status.includes('المقاول') ? 'selected' : ''}>⏳ تحت معالجة المقاول</option>
              <option value="معاد للجهة المالكة" ${report.status.includes('معاد') ? 'selected' : ''}>✕ معاد للجهة المالكة</option>
              <option value="قيد المتابعة" ${(!report.status.includes('تمت المعالجة') && !report.status.includes('معاد') && !report.status.includes('المقاول')) ? 'selected' : ''}>📋 قيد المتابعة والتدقيق</option>
            </select>
          </div>
        </div>
      `;
    }

    if (actions) {
      actions.innerHTML = `
        <button class="ios-btn ios-btn-success" onclick="ActionSheet.saveManualEdit()">
          💾 حفظ التعديل فوراً
        </button>
        <button class="ios-btn ios-btn-secondary" onclick="ActionSheet.cancelEdit()">
          إلغاء
        </button>
      `;
    }
  }

  static onManagerChange(selectedManager) {
    const projSelect = document.getElementById('editProjectSelect');
    const projInput = document.getElementById('editProjectManualInput');
    if (!projSelect) return;

    const mgrProjects = window.SpatialEngine.getProjectsForManager(selectedManager);
    let html = '<option value="">-- اختر المشروع من القائمة المعتمدة --</option>';
    mgrProjects.forEach(p => {
      html += `<option value="${p.projectName}" data-full="${p.fullTitle}" data-contractor="${p.contractor}">${p.projectName} [${p.contractor}] - (${p.districtScope})</option>`;
    });

    projSelect.innerHTML = html;
    if (mgrProjects.length > 0) {
      projSelect.value = mgrProjects[0].projectName;
      if (projInput) projInput.value = mgrProjects[0].projectName;
    } else {
      if (projInput) projInput.value = (selectedManager === 'إدارة الصيانة العامة') ? 'خارج نطاق المشاريع (صيانة)' : '';
    }
  }

  static onProjectSelectChange(selectEl) {
    const projInput = document.getElementById('editProjectManualInput');
    if (projInput && selectEl.value) {
      projInput.value = selectEl.value;
    }
  }

  static enableEditMode() {
    if (!window.ActionSheetInstance) return;
    window.ActionSheetInstance.isEditMode = true;
    window.ActionSheetInstance.render();
  }

  static cancelEdit() {
    if (!window.ActionSheetInstance) return;
    window.ActionSheetInstance.isEditMode = false;
    window.ActionSheetInstance.render();
  }

  static saveManualEdit() {
    if (!window.ActionSheetInstance || !window.ActionSheetInstance.currentReport) return;
    const r = window.ActionSheetInstance.currentReport;

    const mgrSelect = document.getElementById('editManagerSelect');
    const projSelect = document.getElementById('editProjectSelect');
    const projInput = document.getElementById('editProjectManualInput');
    const statusSelect = document.getElementById('editStatusSelect');

    const newManager = mgrSelect ? mgrSelect.value : r.programManager;
    let newProject = (projInput && projInput.value.trim()) ? projInput.value.trim() : (projSelect ? projSelect.value : r.matchedProject);
    const newStatus = statusSelect ? statusSelect.value : r.status;

    let fullTitle = newProject;
    if (projSelect && projSelect.selectedOptions && projSelect.selectedOptions[0]) {
      const opt = projSelect.selectedOptions[0];
      if (opt.dataset && opt.dataset.full) {
        fullTitle = opt.dataset.full;
      }
    }

    // Persist in localStorage
    let manualEdits = {};
    try {
      const stored = localStorage.getItem('nwc_manual_edits');
      if (stored) manualEdits = JSON.parse(stored);
    } catch (e) {}

    manualEdits[r.id] = {
      programManager: newManager,
      projectName: newProject,
      fullTitle: fullTitle,
      status: newStatus
    };
    localStorage.setItem('nwc_manual_edits', JSON.stringify(manualEdits));

    // Update report object
    r.programManager = newManager;
    r.matchedProject = newProject;
    r.fullProjectTitle = fullTitle;
    r.status = newStatus;
    r.isProjectContractor = (newManager !== 'إدارة الصيانة العامة');
    r.department = r.isProjectContractor ? 'إدارة المشاريع' : 'إدارة الصيانة';
    r.departmentKey = r.isProjectContractor ? 'projects' : 'maintenance';

    // Notify App to refresh stats, sidebar badges, table, charts, and map
    if (window.App) {
      window.App.recomputeAndRefresh();
      window.App.showToast(`تم حفظ وتحديث بيانات البلاغ #${r.id} بنجاح`);
    }

    window.ActionSheetInstance.isEditMode = false;
    window.ActionSheetInstance.render();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.ActionSheetInstance = new ActionSheet();
});
