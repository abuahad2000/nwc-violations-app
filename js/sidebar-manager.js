/**
 * Interactive Sidebar Manager Module
 * Professional iOS-styled sidebar displaying the 10 Program Managers with live status badges.
 */

class SidebarManager {
  constructor() {
    this.container = document.getElementById('programManagersSidebar');
    this.selectedManager = 'projects_all'; // 'projects_all' | 'maintenance_all' | managerName
    this.managersData = {};
    this.initEvents();
  }

  initEvents() {
    // Search input inside sidebar
    const searchInput = document.getElementById('sidebarManagerSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterManagerItems(e.target.value.trim().toLowerCase());
      });
    }
  }

  /**
   * Update sidebar with live counts from SpatialEngine KPIs
   * @param {Object} kpis 
   */
  updateCounts(kpis) {
    this.managersData = kpis.managers || {};
    this.render();
  }

  /**
   * Render sidebar manager items
   */
  render() {
    if (!this.container) return;

    const managersList = window.SpatialEngine.OFFICIAL_MANAGERS;
    const projectTotal = (window.App && window.App.kpis) ? window.App.kpis.projectContractorsTotal : 0;
    const maintenanceTotal = (window.App && window.App.kpis) ? window.App.kpis.maintenanceTotal : 0;

    let html = `
      <!-- Option 1: All Projects Contractors -->
      <div class="ios-sidebar-item ${this.selectedManager === 'projects_all' ? 'active' : ''}" 
           onclick="SidebarManager.selectManager('projects_all')">
        <div class="ios-sidebar-icon" style="background: linear-gradient(135deg, #007AFF, #5856D6);">
          🏢
        </div>
        <div class="ios-sidebar-info">
          <div class="ios-sidebar-name">كافة مقاولي المشاريع</div>
          <div class="ios-sidebar-desc">نطاقات KMZ + استثناء عبدالله الأسود</div>
        </div>
        <div class="ios-sidebar-badge badge-blue">
          ${projectTotal.toLocaleString('ar-SA')}
        </div>
      </div>

      <div class="ios-sidebar-separator">قائمة مديري البرامج (NWC)</div>
    `;

    managersList.forEach((m, idx) => {
      const stats = this.managersData[m.name] || { total: 0, open: 0, resolved: 0 };
      const isSelected = this.selectedManager === m.name;
      const isAswad = m.name.includes('الأسود');

      // Colors & Icons
      let icon = '👔';
      let iconBg = 'rgba(0, 122, 255, 0.12)';
      let roleColor = 'var(--ios-blue)';

      if (m.sector === 'صرف') {
        icon = '🚰';
        iconBg = 'rgba(175, 82, 222, 0.14)';
        roleColor = 'var(--ios-purple)';
      } else if (m.sector === 'مياه') {
        icon = '💧';
        iconBg = 'rgba(48, 176, 199, 0.14)';
        roleColor = 'var(--ios-teal)';
      } else if (isAswad) {
        icon = '⭐';
        iconBg = 'rgba(255, 149, 0, 0.15)';
        roleColor = 'var(--ios-orange)';
      }

      // Open reports badge
      const badgeHtml = stats.open > 0
        ? `<div class="ios-sidebar-badge badge-red" title="${stats.open} بلاغ معلق">${stats.open.toLocaleString('ar-SA')} معلق</div>`
        : `<div class="ios-sidebar-badge badge-green" title="مكتمل">${stats.total.toLocaleString('ar-SA')}</div>`;

      html += `
        <div class="ios-sidebar-item ${isSelected ? 'active' : ''}" 
             data-search="${m.name} ${m.role}"
             onclick="SidebarManager.selectManager('${m.name}')">
          <div class="ios-sidebar-icon" style="background: ${iconBg};">
            ${icon}
          </div>
          <div class="ios-sidebar-info">
            <div class="ios-sidebar-name">
              ${m.name}
              ${isAswad ? '<span class="ios-star-pill" title="استثناء: يشمل كامل الرياض لمقاوليه">نطاق شامل</span>' : ''}
            </div>
            <div class="ios-sidebar-desc" style="color: ${roleColor};">${m.role}</div>
          </div>
          ${badgeHtml}
        </div>
      `;
    });

    // Option: Maintenance Dept (Outside KMZ)
    html += `
      <div class="ios-sidebar-separator">إدارات أخرى</div>
      <div class="ios-sidebar-item ${this.selectedManager === 'maintenance_all' ? 'active' : ''}" 
           onclick="SidebarManager.selectManager('maintenance_all')">
        <div class="ios-sidebar-icon" style="background: rgba(255, 149, 0, 0.12);">
          🔧
        </div>
        <div class="ios-sidebar-info">
          <div class="ios-sidebar-name">إدارة الصيانة (خارج KMZ)</div>
          <div class="ios-sidebar-desc">شبكات قائمة مستبعدة من المشاريع</div>
        </div>
        <div class="ios-sidebar-badge badge-orange">
          ${maintenanceTotal.toLocaleString('ar-SA')}
        </div>
      </div>
    `;

    this.container.innerHTML = html;
  }

  /**
   * Filter manager items in sidebar
   * @param {string} query 
   */
  filterManagerItems(query) {
    const items = this.container.querySelectorAll('.ios-sidebar-item[data-search]');
    items.forEach(item => {
      const text = item.getAttribute('data-search').toLowerCase();
      if (!query || text.includes(query)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  }

  static selectManager(managerKey) {
    if (!window.SidebarManagerInstance) return;
    window.SidebarManagerInstance.selectedManager = managerKey;
    window.SidebarManagerInstance.render();

    if (window.App) {
      window.App.onManagerSelected(managerKey);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.SidebarManagerInstance = new SidebarManager();
});
