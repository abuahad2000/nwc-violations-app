/**
 * iOS Interactive Charts Manager (Chart.js)
 * System: "تعديات الخاصة بمقاولي مشاريع شركة المياه الوطنية"
 * Renders 3 Apple HIG-styled dynamic charts:
 * 1. Bar Chart: Open vs Resolved reports by Project
 * 2. Donut Chart: Status distribution percentages
 * 3. Scope / District Comparison Chart
 */

class ChartsManager {
  constructor() {
    this.barChart = null;
    this.donutChart = null;
    this.comparisonChart = null;
    this.reports = [];
    this.selectedManager = 'projects_all';

    // Apple iOS Color Palette
    this.colors = {
      blue: '#007AFF',
      green: '#34C759',
      orange: '#FF9500',
      red: '#FF3B30',
      purple: '#AF52DE',
      indigo: '#5856D6',
      teal: '#30B0C7',
      yellow: '#FFCC00',
      gray: '#8E8E93',
      darkCard: 'rgba(28, 28, 30, 0.85)'
    };
  }

  init() {
    if (typeof Chart === 'undefined') {
      console.warn('[ChartsManager] Chart.js is not loaded yet.');
      return;
    }

    // Set Chart.js global defaults for iOS feel
    Chart.defaults.font.family = 'Cairo, -apple-system, BlinkMacSystemFont, sans-serif';
    Chart.defaults.color = '#3C3C43';
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    if (Chart.defaults.plugins && Chart.defaults.plugins.legend) {
      Chart.defaults.plugins.legend.labels.usePointStyle = true;
      Chart.defaults.plugins.legend.labels.boxWidth = 8;
      Chart.defaults.plugins.legend.labels.font = {
        family: 'Cairo, sans-serif',
        size: 11,
        weight: '600'
      };
    }
  }

  update(reports, selectedManager) {
    this.reports = reports || [];
    this.selectedManager = selectedManager || 'projects_all';

    if (typeof Chart === 'undefined') {
      return;
    }

    this.renderBarChart();
    this.renderDonutChart();
    this.renderComparisonChart();
  }

  /**
   * Filter reports according to selected manager
   */
  getScopedReports() {
    if (this.selectedManager === 'projects_all') {
      return this.reports.filter(r => r.isProjectContractor);
    } else if (this.selectedManager === 'maintenance_all') {
      return this.reports.filter(r => !r.isProjectContractor);
    } else if (this.selectedManager !== 'all') {
      return this.reports.filter(r => r.programManager === this.selectedManager);
    }
    return this.reports;
  }

  /**
   * 1. Bar Chart: Distribution of open vs resolved reports by project
   */
  renderBarChart() {
    const canvas = document.getElementById('chartProjectsBar');
    if (!canvas) return;

    if (this.barChart) {
      this.barChart.destroy();
      this.barChart = null;
    }

    const scoped = this.getScopedReports();
    if (scoped.length === 0) {
      this.renderEmptyChart(canvas, 'لا توجد بلاغات لعرض مخطط المشاريع');
      return;
    }

    // Group by project
    const projectMap = {};
    scoped.forEach(r => {
      let pName = r.matchedProject || 'مشروع غير محدد';
      // Truncate long project name for labels
      const shortName = pName.length > 28 ? pName.slice(0, 25) + '...' : pName;
      if (!projectMap[shortName]) {
        projectMap[shortName] = { fullName: pName, open: 0, resolved: 0, total: 0 };
      }
      projectMap[shortName].total++;
      const st = (r.status || '').trim();
      if (st.includes('تمت المعالجة') || st.includes('منجز')) {
        projectMap[shortName].resolved++;
      } else {
        projectMap[shortName].open++;
      }
    });

    // Sort by total descending and take top 8
    const sortedEntries = Object.entries(projectMap)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 8);

    const labels = sortedEntries.map(e => e[0]);
    const openData = sortedEntries.map(e => e[1].open);
    const resolvedData = sortedEntries.map(e => e[1].resolved);

    const ctx = canvas.getContext('2d');
    this.barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'بلاغات مفتوحة / قيد الإجراء',
            data: openData,
            backgroundColor: 'rgba(255, 149, 0, 0.85)',
            borderColor: '#FF9500',
            borderWidth: 1.5,
            borderRadius: 8,
            borderSkipped: false
          },
          {
            label: 'بلاغات منجزة / معالجة',
            data: resolvedData,
            backgroundColor: 'rgba(52, 199, 89, 0.85)',
            borderColor: '#34C759',
            borderWidth: 1.5,
            borderRadius: 8,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            rtl: true
          },
          tooltip: {
            rtl: true,
            titleFont: { family: 'Cairo', weight: '700' },
            bodyFont: { family: 'Cairo' },
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                return sortedEntries[idx][1].fullName;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            ticks: {
              font: { family: 'Cairo', size: 10 },
              maxRotation: 25
            },
            grid: { display: false }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              precision: 0,
              font: { family: 'Cairo', size: 10 }
            },
            grid: {
              color: 'rgba(60, 60, 67, 0.08)'
            }
          }
        }
      }
    });
  }

  /**
   * 2. Donut Chart: Report status distribution
   */
  renderDonutChart() {
    const canvas = document.getElementById('chartStatusDonut');
    if (!canvas) return;

    if (this.donutChart) {
      this.donutChart.destroy();
      this.donutChart = null;
    }

    const scoped = this.getScopedReports();
    if (scoped.length === 0) {
      this.renderEmptyChart(canvas, 'لا توجد بيانات لحالة البلاغات');
      return;
    }

    let resolvedCount = 0;
    let inProgressCount = 0;
    let returnedCount = 0;
    let pendingCount = 0;

    scoped.forEach(r => {
      const st = (r.status || '').trim();
      if (st.includes('تمت المعالجة') || st.includes('منجز')) {
        resolvedCount++;
      } else if (st.includes('تحت معالجة المقاول') || st.includes('المقاول')) {
        inProgressCount++;
      } else if (st.includes('معاد') || st.includes('مرفوض')) {
        returnedCount++;
      } else {
        pendingCount++;
      }
    });

    const ctx = canvas.getContext('2d');
    const total = scoped.length;

    this.donutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [
          'تمت المعالجة',
          'تحت معالجة المقاول',
          'معاد للجهة المالكة',
          'قيد المتابعة'
        ],
        datasets: [{
          data: [resolvedCount, inProgressCount, returnedCount, pendingCount],
          backgroundColor: [
            '#34C759',
            '#FF9500',
            '#FF3B30',
            '#007AFF'
          ],
          borderWidth: 2,
          borderColor: '#FFFFFF',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            rtl: true,
            labels: {
              padding: 10,
              font: { family: 'Cairo', size: 10 }
            }
          },
          tooltip: {
            rtl: true,
            callbacks: {
              label: (item) => {
                const val = item.raw;
                const pct = ((val / total) * 100).toFixed(1);
                return ` ${item.label}: ${val} بلاغ (${pct}%)`;
              }
            }
          }
        }
      }
    });

    // Update center donut stat counter
    const centerCounter = document.getElementById('donutCenterCount');
    if (centerCounter) {
      centerCounter.textContent = total;
    }
  }

  /**
   * 3. Comparison Chart: Volume across districts / scopes / sectors
   */
  renderComparisonChart() {
    const canvas = document.getElementById('chartSectorComparison');
    if (!canvas) return;

    if (this.comparisonChart) {
      this.comparisonChart.destroy();
      this.comparisonChart = null;
    }

    const scoped = this.getScopedReports();
    if (scoped.length === 0) {
      this.renderEmptyChart(canvas, 'لا توجد بيانات للمقارنة');
      return;
    }

    // Group by District / Scope
    const scopeMap = {};
    scoped.forEach(r => {
      let scopeKey = r.district || r.districtScope || 'أخرى';
      if (!scopeMap[scopeKey]) scopeMap[scopeKey] = 0;
      scopeMap[scopeKey]++;
    });

    const sortedScopes = Object.entries(scopeMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const labels = sortedScopes.map(s => s[0]);
    const data = sortedScopes.map(s => s[1]);

    const palette = [
      '#AF52DE',
      '#5856D6',
      '#007AFF',
      '#30B0C7',
      '#FF9500',
      '#FF2D55'
    ];

    const ctx = canvas.getContext('2d');
    this.comparisonChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'حجم البلاغات حسب النطاق',
          data: data,
          backgroundColor: palette.slice(0, labels.length),
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: 'y', // Horizontal bar for clean iOS look
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            rtl: true,
            callbacks: {
              label: (item) => ` ${item.raw} بلاغ في هذا النطاق`
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { precision: 0, font: { family: 'Cairo', size: 10 } },
            grid: { color: 'rgba(60, 60, 67, 0.08)' }
          },
          y: {
            ticks: { font: { family: 'Cairo', size: 11, weight: '600' } },
            grid: { display: false }
          }
        }
      }
    });
  }

  renderEmptyChart(canvas, message) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '600 13px Cairo, sans-serif';
    ctx.fillStyle = '#8E8E93';
    ctx.textAlign = 'center';
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.ChartsManagerInstance = new ChartsManager();
  window.ChartsManagerInstance.init();
});
