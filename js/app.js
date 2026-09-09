/**
 * Main Application Orchestrator
 * System: "تعديات الخاصة بمقاولي مشاريع شركة المياه الوطنية"
 * Coordinates Sidebar Manager, Spatial Engine, OpenStreetMap, Table, and Actions.
 */

class AppController {
  constructor() {
    this.reports = [];
    this.rawReports = [];
    this.projectBoundaries = null;
    this.kpis = null;
    this.selectedManager = 'projects_all'; // 'projects_all' | 'maintenance_all' | managerName
    this.activeDualFilter = 'all';
    this.currentView = 'both';

    this.init();
  }

  async init() {
    console.log('[AppController] Initializing NWC Project Contractors Encroachments System...');

    // 1. Initialize OpenStreetMap
    if (window.MapManager) {
      window.MapManager.initMap('map');
    }

    // 2. Setup DOM Events
    this.bindEvents();

    // 3. Load Program Managers Registry
    await window.SpatialEngine.loadRegistry();

    // 4. Auto-load Permanent Project Boundaries (KMZ)
    this.showLoading('جاري تحميل وتثبيت نطاقات المشاريع المعتمدة (KMZ)...');
    try {
      const geojson = await window.KMZLoader.loadDefaultBoundaries();
      if (geojson) {
        this.projectBoundaries = geojson;
        window.SpatialEngine.setBoundaries(geojson);
        window.MapManager.renderBoundaries(geojson);

        const bannerText = document.getElementById('kmzStatusText');
        if (bannerText) {
          bannerText.textContent = `تم تثبيت ${geojson.features.length} نطاق مشروع معتمد (KMZ)`;
        }
      }
    } catch (e) {
      console.error('Error loading default KMZ:', e);
    }

    // 5. Auto-load Default Encroachments (3,824 records)
    try {
      this.showLoading('جاري فرز بلاغات مقاولي المشاريع وحصر استثناء م. عبدالله الأسود...');
      const defaultReports = await window.ExcelParser.loadDefaultReports();
      if (defaultReports && defaultReports.length > 0) {
        this.rawReports = defaultReports;
        this.processAndDisplayReports(defaultReports);
        this.showToast(`تم تحميل وفحص ${defaultReports.length} بلاغ بنجاح`);
      }
    } catch (e) {
      console.error('Error loading default reports:', e);
    } finally {
      this.hideLoading();
    }
  }

  bindEvents() {
    // Excel Drag and Drop
    const dropzone = document.getElementById('excelDropzone');
    const fileInput = document.getElementById('excelFileInput');

    if (dropzone && fileInput) {
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropzone.classList.remove('dragover');
        });
      });

      dropzone.addEventListener('drop', async (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          await this.handleExcelUpload(files[0]);
        }
      });

      fileInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
          await this.handleExcelUpload(e.target.files[0]);
        }
      });
    }

    // Quick Load Button
    const quickLoadBtn = document.getElementById('quickLoadBtn');
    if (quickLoadBtn) {
      quickLoadBtn.addEventListener('click', async () => {
        this.showLoading('جاري إعادة تحميل البيانات المرجعية...');
        const reports = await window.ExcelParser.loadDefaultReports();
        this.rawReports = reports;
        this.processAndDisplayReports(reports);
        this.hideLoading();
        this.showToast('تم تحميل بيانات التعديات المرجعية');
      });
    }

    // Custom KMZ Upload
    const kmzInput = document.getElementById('kmzFileInput');
    if (kmzInput) {
      kmzInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
          await this.handleKMZUpload(e.target.files[0]);
        }
      });
    }

    // Segmented Control Tabs (Dual Filter)
    const segButtons = document.querySelectorAll('.ios-segmented-btn');
    segButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        segButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.dataset.filter;
        this.setDualFilter(filter);
      });
    });

    // View Switch Buttons (Map vs Table vs Both)
    const viewButtons = document.querySelectorAll('.ios-view-btn');
    viewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        viewButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const view = btn.dataset.view;
        this.switchView(view);
      });
    });
  }

  async handleExcelUpload(file) {
    this.showLoading('جاري قراءة ملف Excel وفرز مقاولي المشاريع...');
    try {
      const parsedReports = await window.ExcelParser.parseFile(file);
      if (parsedReports.length === 0) {
        alert('لم يتم العثور على بلاغات صالحة بإحداثيات صحيحة في الملف.');
        return;
      }
      this.rawReports = parsedReports;
      this.processAndDisplayReports(parsedReports);
      this.showToast(`تم استيراد ${parsedReports.length} بلاغ من الملف: ${file.name}`);
    } catch (err) {
      alert('خطأ في قراءة ملف الإكسل: ' + err.message);
      console.error(err);
    } finally {
      this.hideLoading();
    }
  }

  async handleKMZUpload(file) {
    this.showLoading('جاري استخراج المضلعات الجغرافية من ملف KMZ/KML...');
    try {
      const geojson = await window.KMZLoader.parseKMZFile(file);
      if (!geojson || geojson.features.length === 0) {
        alert('لم يتم العثور على مضلعات صالحة داخل الملف.');
        return;
      }

      this.projectBoundaries = geojson;
      window.SpatialEngine.setBoundaries(geojson);
      window.MapManager.renderBoundaries(geojson);

      const bannerText = document.getElementById('kmzStatusText');
      if (bannerText) {
        bannerText.textContent = `تم تحديث النطاقات: ${geojson.features.length} مضلع من (${file.name})`;
      }

      if (this.rawReports.length > 0) {
        this.processAndDisplayReports(this.rawReports);
      }

      this.showToast(`تم تحديث نطاقات المشاريع (${geojson.features.length} مضلع)`);
    } catch (err) {
      alert('خطأ في معالجة ملف KMZ: ' + err.message);
      console.error(err);
    } finally {
      this.hideLoading();
    }
  }

  processAndDisplayReports(rawReports) {
    // 1. Process with strict KMZ exclusion & Al-Aswad rule
    const classified = window.SpatialEngine.processReports(rawReports);
    this.reports = classified;

    // 2. Compute KPIs
    const kpis = window.SpatialEngine.computeKPIs(classified);
    this.kpis = kpis;

    // 3. Update Sidebar with real-time manager counts
    if (window.SidebarManagerInstance) {
      window.SidebarManagerInstance.updateCounts(kpis);
    }

    // 4. Update Top KPI Display
    this.updateKPIDisplay();

    // 5. Update Map Markers
    window.MapManager.renderReports(classified);
    window.MapManager.setManagerFilter(this.selectedManager);
    window.MapManager.setDualFilter(this.activeDualFilter);

    // 6. Update Table
    if (window.TableManagerInstance) {
      window.TableManagerInstance.setData(classified);
      window.TableManagerInstance.setManagerFilter(this.selectedManager);
      window.TableManagerInstance.setFilter(this.activeDualFilter);
    }

    // 7. Update Interactive Dashboard Charts
    if (window.ChartsManagerInstance) {
      window.ChartsManagerInstance.update(classified, this.selectedManager);
    }
  }

  /**
   * Recompute state after user manual edit in ActionSheet
   */
  recomputeAndRefresh() {
    if (this.rawReports.length > 0) {
      this.processAndDisplayReports(this.rawReports);
    }
  }

  /**
   * When user clicks on a Program Manager in the Sidebar
   */
  onManagerSelected(managerKey) {
    this.selectedManager = managerKey;

    // 1. Update Map
    if (window.MapManager) {
      window.MapManager.setManagerFilter(managerKey);
    }

    // 2. Update Table
    if (window.TableManagerInstance) {
      window.TableManagerInstance.setManagerFilter(managerKey);
    }

    // 3. Update KPI Banner & Cards
    this.updateKPIDisplay();

    // 4. Update Interactive Dashboard Charts
    if (window.ChartsManagerInstance) {
      window.ChartsManagerInstance.update(this.reports, managerKey);
    }

    // 5. Update Charts Section Header Badge
    const chartsBadge = document.getElementById('chartsActiveManagerBadge');
    if (chartsBadge) {
      if (managerKey === 'projects_all') chartsBadge.textContent = 'كافة مقاولي المشاريع';
      else if (managerKey === 'maintenance_all') chartsBadge.textContent = 'إدارة الصيانة العامة';
      else chartsBadge.textContent = `م. ${managerKey}`;
    }
  }

  /**
   * Update top KPI Cards based on currently selected manager or all project contractors
   */
  updateKPIDisplay() {
    if (!this.kpis) return;

    const elScopeTitle = document.getElementById('kpiScopeTitle');
    const elScopeDesc = document.getElementById('kpiScopeDesc');

    const elTotal = document.getElementById('kpiTotalVal');
    const elWaterTotal = document.getElementById('kpiWaterTotalVal');
    const elSewerTotal = document.getElementById('kpiSewerTotalVal');
    const elRate = document.getElementById('kpiRateVal');

    const elTotalSub = document.getElementById('kpiTotalSub');
    const elWaterProj = document.getElementById('kpiWaterProjSub');
    const elWaterMaint = document.getElementById('kpiWaterMaintSub');
    const elSewerProj = document.getElementById('kpiSewerProjSub');
    const elSewerMaint = document.getElementById('kpiSewerMaintSub');
    const elResolvedSub = document.getElementById('kpiResolvedSub');

    let total = 0, open = 0, resolved = 0, rate = '0.0%';
    let waterProj = 0, waterMaint = 0, sewerProj = 0, sewerMaint = 0;
    let waterTotal = 0, sewerTotal = 0;

    if (this.selectedManager === 'projects_all') {
      // All Project Contractors (KMZ Inside + Abdullah Al-Aswad Exception)
      if (elScopeTitle) elScopeTitle.textContent = '🏢 كافة مقاولي مشاريع شركة المياه الوطنية';
      if (elScopeDesc) elScopeDesc.textContent = 'حصر بلاغات مقاولي المشاريع داخل نطاقات KMZ + كامل عقود م. عبدالله الأسود العنزي';

      const projectReports = this.reports.filter(r => r.isProjectContractor);
      total = projectReports.length;
      projectReports.forEach(r => {
        const isRes = (r.status || '').includes('تمت المعالجة') || (r.status || '').includes('منجز');
        if (isRes) resolved++; else open++;

        if (r.sectorKey === 'water') {
          waterTotal++;
          if (r.departmentKey === 'projects') waterProj++; else waterMaint++;
        } else {
          sewerTotal++;
          if (r.departmentKey === 'projects') sewerProj++; else sewerMaint++;
        }
      });
      rate = total > 0 ? ((resolved / total) * 100).toFixed(1) + '%' : '0.0%';

      if (elTotalSub) elTotalSub.textContent = `${open} بلاغ مفتوح يتطلب معالجة المقاول`;
    } else if (this.selectedManager === 'maintenance_all') {
      if (elScopeTitle) elScopeTitle.textContent = '🔧 بلاغات إدارة الصيانة (خارج نطاقات المشاريع)';
      if (elScopeDesc) elScopeDesc.textContent = 'شبكات قائمة مستبعدة من عقود مقاولي المشاريع الجارية';

      const maintReports = this.reports.filter(r => !r.isProjectContractor);
      total = maintReports.length;
      maintReports.forEach(r => {
        const isRes = (r.status || '').includes('تمت المعالجة') || (r.status || '').includes('منجز');
        if (isRes) resolved++; else open++;
        if (r.sectorKey === 'water') waterTotal++; else sewerTotal++;
      });
      rate = total > 0 ? ((resolved / total) * 100).toFixed(1) + '%' : '0.0%';
      if (elTotalSub) elTotalSub.textContent = `تابعة لفرق التشغيل والصيانة`;
    } else {
      // Specific Program Manager
      const mgrName = this.selectedManager;
      const mgrData = this.kpis.managers[mgrName] || {};
      const mgrReports = this.reports.filter(r => r.programManager === mgrName);

      if (elScopeTitle) elScopeTitle.textContent = `👤 مدير البرنامج: ${mgrName}`;
      if (elScopeDesc) elScopeDesc.textContent = `نطاق الاختصاص: ${mgrData.role || ''}`;

      total = mgrReports.length;
      mgrReports.forEach(r => {
        const isRes = (r.status || '').includes('تمت المعالجة') || (r.status || '').includes('منجز');
        if (isRes) resolved++; else open++;

        if (r.sectorKey === 'water') {
          waterTotal++;
          if (r.departmentKey === 'projects') waterProj++; else waterMaint++;
        } else {
          sewerTotal++;
          if (r.departmentKey === 'projects') sewerProj++; else sewerMaint++;
        }
      });
      rate = total > 0 ? ((resolved / total) * 100).toFixed(1) + '%' : '0.0%';
      if (elTotalSub) elTotalSub.textContent = `${open} بلاغ معلق مسند للمدير`;
    }

    if (elTotal) elTotal.textContent = total.toLocaleString('ar-SA');
    if (elWaterTotal) elWaterTotal.textContent = waterTotal.toLocaleString('ar-SA');
    if (elSewerTotal) elSewerTotal.textContent = sewerTotal.toLocaleString('ar-SA');
    if (elRate) elRate.textContent = rate;

    if (elWaterProj) elWaterProj.textContent = `مشاريع: ${waterProj.toLocaleString('ar-SA')}`;
    if (elWaterMaint) elWaterMaint.textContent = `صيانة: ${waterMaint.toLocaleString('ar-SA')}`;
    if (elSewerProj) elSewerProj.textContent = `مشاريع: ${sewerProj.toLocaleString('ar-SA')}`;
    if (elSewerMaint) elSewerMaint.textContent = `صيانة: ${sewerMaint.toLocaleString('ar-SA')}`;
    if (elResolvedSub) elResolvedSub.textContent = `${resolved.toLocaleString('ar-SA')} بلاغ منجز`;
  }

  setDualFilter(dualFilterKey) {
    this.activeDualFilter = dualFilterKey;
    if (window.MapManager) {
      window.MapManager.setDualFilter(dualFilterKey);
    }
    if (window.TableManagerInstance) {
      window.TableManagerInstance.setFilter(dualFilterKey);
    }
  }

  switchView(viewMode) {
    this.currentView = viewMode;
    const mapSection = document.getElementById('mapSection');
    const tableSection = document.getElementById('tableSection');

    if (!mapSection || !tableSection) return;

    if (viewMode === 'map') {
      mapSection.style.display = 'block';
      tableSection.style.display = 'none';
      if (window.MapManager && window.MapManager.map) {
        window.MapManager.map.invalidateSize();
      }
    } else if (viewMode === 'table') {
      mapSection.style.display = 'none';
      tableSection.style.display = 'block';
    } else {
      mapSection.style.display = 'block';
      tableSection.style.display = 'block';
      if (window.MapManager && window.MapManager.map) {
        window.MapManager.map.invalidateSize();
      }
    }
  }

  showLoading(text = 'جاري المعالجة...') {
    const overlay = document.getElementById('loadingOverlay');
    const textEl = document.getElementById('loadingText');
    if (textEl) textEl.textContent = text;
    if (overlay) overlay.classList.add('active');
  }

  hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('active');
  }

  showToast(message) {
    const toast = document.getElementById('appToast');
    const text = document.getElementById('toastText');
    if (text) text.textContent = message;
    if (toast) {
      toast.classList.add('active');
      setTimeout(() => {
        toast.classList.remove('active');
      }, 3600);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.App = new AppController();
});
