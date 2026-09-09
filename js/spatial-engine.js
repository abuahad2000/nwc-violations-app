/**
 * Spatial Engine & Business Logic
 * Strict Program Managers Filtering + Eng. Abdullah Al-Aswad Al-Anazi Special Exception
 * + 97 Approved Projects Registry Matching
 * + Dual Classification (Water & Sewer × Projects & Maintenance)
 */

class SpatialEngine {
  constructor() {
    this.polygons = [];
    this.managers = [];
    this.projects = [];
    this.isRegistryLoaded = false;

    // The 10 Official Program Managers
    this.OFFICIAL_MANAGERS = [
      { name: 'تركي ظافر يحيى الاسمري', role: 'صرف جنوب الرياض', sector: 'صرف' },
      { name: 'عسكر لسلوم', role: 'صرف شمال الرياض', sector: 'صرف' },
      { name: 'أمجد الفالح', role: 'صرف غرب الرياض', sector: 'صرف' },
      { name: 'سفر العتيبي', role: 'مياه شمال الرياض', sector: 'مياه' },
      { name: 'علي الشهري', role: 'مياه جنوب الرياض', sector: 'مياه' },
      { name: 'عبدالله علي العنزي', role: 'مياه غرب الرياض', sector: 'مياه' },
      { name: 'عبدالله الأسود العنزي', role: 'مشاريع متفرقة مياه وصرف - كامل الرياض', sector: 'مياه وصرف' },
      { name: 'علي القحطاني', role: 'مياه وصرف - المحافظات الشمالية', sector: 'مياه وصرف' },
      { name: 'شاكر الحقباني', role: 'مياه وصرف - المحافظات الجنوبية', sector: 'مياه وصرف' },
      { name: 'سعيد الحارث', role: 'مياه وصرف - المحافظات الغربية', sector: 'مياه وصرف' }
    ];

    // Approved Contractors for Abdullah Al-Aswad Al-Anazi (covers all of Riyadh without KMZ restriction)
    this.ASWAD_CONTRACTORS = [
      'مجموعة سعد علي العيسى للمقاولات',
      'مؤسسة العرين للمقاولات',
      'شركة الاومير للتجارة والمقاولات',
      'مؤسسة ثليل للمقاولات',
      'شركة صلت للمقاولات'
    ];
  }

  async loadRegistry() {
    if (this.isRegistryLoaded) return;
    try {
      const res = await fetch('data/program_managers_registry.json');
      if (res.ok) {
        const data = await res.json();
        this.managers = data.managers || this.OFFICIAL_MANAGERS;
        this.projects = data.projects || [];
        this.isRegistryLoaded = true;
        console.log(`[SpatialEngine] Loaded ${this.projects.length} projects across ${this.managers.length} managers from registry.`);
      }
    } catch (e) {
      console.warn('[SpatialEngine] Could not load program_managers_registry.json:', e);
    }
  }

  getProjectsForManager(managerName) {
    if (!managerName || managerName === 'projects_all' || managerName === 'all') {
      return this.projects;
    }
    return this.projects.filter(p => p.manager === managerName);
  }

  setBoundaries(geojson) {
    this.polygons = [];
    if (!geojson || !geojson.features) return;

    geojson.features.forEach((feature, idx) => {
      const geom = feature.geometry;
      if (!geom) return;

      const rings = [];
      if (geom.type === 'Polygon') {
        rings.push(geom.coordinates[0]);
      } else if (geom.type === 'MultiPolygon') {
        geom.coordinates.forEach(poly => rings.push(poly[0]));
      }

      rings.forEach(ring => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        ring.forEach(pt => {
          if (pt[0] < minX) minX = pt[0];
          if (pt[0] > maxX) maxX = pt[0];
          if (pt[1] < minY) minY = pt[1];
          if (pt[1] > maxY) maxY = pt[1];
        });

        const name = feature.properties?.name || 'مشروع جاري';
        const source = feature.properties?.source || 'KMZ';
        const isSewer = source.includes('صرف') || name.includes('صرف');

        this.polygons.push({
          id: feature.properties?.id || idx + 1,
          name: name,
          source: source,
          sector: isSewer ? 'sewer' : 'water',
          ring: ring,
          bbox: [minX, minY, maxX, maxY]
        });
      });
    });

    console.log(`[SpatialEngine] Indexed ${this.polygons.length} polygon rings for fast spatial indexing.`);
  }

  classifyPoint(lng, lat) {
    if (isNaN(lng) || isNaN(lat)) {
      return { isInside: false, project: null };
    }

    for (let i = 0; i < this.polygons.length; i++) {
      const p = this.polygons[i];
      const bbox = p.bbox;

      if (lng < bbox[0] || lng > bbox[2] || lat < bbox[1] || lat > bbox[3]) {
        continue;
      }

      const ring = p.ring;
      const n = ring.length;
      let inside = false;
      let p1x = ring[0][0];
      let p1y = ring[0][1];

      for (let j = 1; j <= n; j++) {
        const p2 = ring[j % n];
        const p2x = p2[0];
        const p2y = p2[1];

        if (lat > Math.min(p1y, p2y)) {
          if (lat <= Math.max(p1y, p2y)) {
            if (lng <= Math.max(p1x, p2x)) {
              if (p1y !== p2y) {
                const xinters = (lat - p1y) * (p2x - p1x) / (p2y - p1y) + p1x;
                if (p1x === p2x || lng <= xinters) {
                  inside = !inside;
                }
              }
            }
          }
        }
        p1x = p2x;
        p1y = p2y;
      }

      if (inside) {
        return {
          isInside: true,
          project: {
            id: p.id,
            name: p.name,
            source: p.source,
            sector: p.sector
          }
        };
      }
    }

    return { isInside: false, project: null };
  }

  classifySector(report, matchedPolygon) {
    if (matchedPolygon && matchedPolygon.sector) {
      return matchedPolygon.sector;
    }

    const desc = (report.description || '').toLowerCase();
    const impact = (report.impact || '').toLowerCase();
    const comment = (report.centerComment || '').toLowerCase();
    const contractor = (report.contractorName || '').toLowerCase();
    const combinedText = `${desc} ${impact} ${comment} ${contractor}`;

    const sewerKeywords = ['صرف', 'صحي', 'مناهل', 'منهل', 'بيارة', 'بيارات', 'انحدار', 'محطة معالجة', 'طفح', 'غرفة تفتيش', 'مطابق', 'شبكة صرف'];
    const waterKeywords = ['تسريب مياه', 'تسرب مياه', 'تسريب', 'تسرب', 'عداد', 'توصيلة مياه', 'توصيل مياه', 'خط ناقل', 'شبكة مياه', 'شبكات مياه', 'ماسورة', 'أنبوب', 'انبوب', 'هدر مياه', 'كسر ماسورة', 'مياه'];

    const hasSewer = sewerKeywords.some(k => combinedText.includes(k));
    const hasWater = waterKeywords.some(k => combinedText.includes(k));

    if (hasSewer && !hasWater) return 'sewer';
    if (hasWater && !hasSewer) return 'water';
    if (hasSewer && hasWater) {
      if (desc.includes('صرف') || desc.includes('منهل') || desc.includes('بيار') || contractor.includes('صرف')) {
        return 'sewer';
      }
      return 'water';
    }

    return 'water';
  }

  /**
   * Check if contractor belongs to Abdullah Al-Aswad Al-Anazi
   */
  isAbdullahAlAswadContractor(contractorName) {
    if (!contractorName) return false;
    const c = contractorName.trim();
    const keywords = ['سعد علي العيسى', 'العرين', 'الاومير', 'الأومير', 'ثليل', 'صلت'];
    return keywords.some(k => c.includes(k));
  }

  /**
   * Find the most relevant project among the manager's official projects
   */
  findBestProject(managerName, report, matchedPolygon) {
    const mgrProjects = this.projects.filter(p => p.manager === managerName);
    if (mgrProjects.length === 0) {
      return {
        projectName: matchedPolygon ? matchedPolygon.name : 'مشروع معتمد',
        fullTitle: matchedPolygon ? matchedPolygon.name : 'مشروع معتمد'
      };
    }

    const cName = (report.contractorName || '').trim();
    const district = (report.district || '').trim();

    // 1. Check direct contractor match
    if (cName) {
      for (const p of mgrProjects) {
        if (p.contractor && (cName.includes(p.contractor) || p.contractor.includes(cName))) {
          return p;
        }
      }
    }

    // 2. Check district scope match
    if (district) {
      for (const p of mgrProjects) {
        if (p.districtScope && p.districtScope.includes(district)) {
          return p;
        }
      }
    }

    // 3. Fallback: match by polygon name or return first project
    if (matchedPolygon && matchedPolygon.name) {
      for (const p of mgrProjects) {
        if (p.projectName.includes(matchedPolygon.name) || matchedPolygon.name.includes(p.projectName)) {
          return p;
        }
      }
    }

    return mgrProjects[0];
  }

  /**
   * Primary Classification & Assignment Engine:
   * 1. Check Abdullah Al-Aswad Al-Anazi exception (NOT restricted by KMZ)
   * 2. If inside KMZ: assign to matching project manager and official project
   * 3. If outside KMZ and not Al-Aswad: Strictly Maintenance Dept (excluded from project managers)
   */
  processReports(reports) {
    const startTime = performance.now();

    // Check for user manual edits from localStorage
    let manualEdits = {};
    try {
      const stored = localStorage.getItem('nwc_manual_edits');
      if (stored) manualEdits = JSON.parse(stored);
    } catch (e) {}

    const classifiedReports = reports.map(report => {
      // 1. Spatial check against KMZ
      const res = this.classifyPoint(report.lng, report.lat);
      const isInside = res.isInside;
      const matchedPoly = res.project;

      // 2. Sector check
      const sectorKey = this.classifySector(report, matchedPoly);
      const sector = sectorKey === 'sewer' ? 'الصرف الصحي' : 'المياه';

      // 3. Check Abdullah Al-Aswad Exception
      const isAswadContractor = this.isAbdullahAlAswadContractor(report.contractorName);

      let department = 'إدارة الصيانة';
      let departmentKey = 'maintenance';
      let programManager = 'إدارة الصيانة العامة';
      let subProgram = 'أعمال التشغيل والصيانة القائمة';
      let matchedProject = 'خارج نطاق المشاريع الجارية';
      let fullProjectTitle = 'خارج نطاق المشاريع الجارية';
      let isProjectContractor = false;

      if (isAswadContractor) {
        // EXCEPTION APPLIED: Assigned to Abdullah Al-Aswad Al-Anazi across all of Riyadh
        isProjectContractor = true;
        department = 'إدارة المشاريع';
        departmentKey = 'projects';
        programManager = 'عبدالله الأسود العنزي';
        subProgram = 'مشاريع متفرقة مياه وصرف - كامل مدينة الرياض';

        const bestP = this.findBestProject(programManager, report, matchedPoly);
        matchedProject = bestP.projectName;
        fullProjectTitle = bestP.fullTitle || bestP.projectName;
      } else if (isInside) {
        // INSIDE KMZ: Assigned to the matching project manager
        isProjectContractor = true;
        department = 'إدارة المشاريع';
        departmentKey = 'projects';

        const polyName = matchedPoly ? matchedPoly.name : '';
        const district = report.district || '';

        // Match based on sector & geographical zone
        if (sectorKey === 'sewer') {
          if (polyName.includes('شمال') || ['الملقا', 'حطين', 'القيروان', 'العارض', 'النرجس', 'الياسمين', 'الربيع'].some(d => district.includes(d))) {
            programManager = 'عسكر لسلوم';
            subProgram = 'صرف شمال الرياض';
          } else if (polyName.includes('غرب') || ['لبن', 'طويق', 'المهدية', 'الدرعية', 'ظهرة لبن'].some(d => district.includes(d))) {
            programManager = 'أمجد الفالح';
            subProgram = 'صرف غرب الرياض';
          } else {
            programManager = 'تركي ظافر يحيى الاسمري';
            subProgram = 'صرف جنوب الرياض';
          }
        } else { // water
          if (polyName.includes('شمال') || ['الملقا', 'حطين', 'القيروان', 'العارض', 'البيان', 'النرجس', 'الياسمين'].some(d => district.includes(d))) {
            programManager = 'سفر العتيبي';
            subProgram = 'مياه شمال الرياض';
          } else if (polyName.includes('غرب') || ['لبن', 'طويق', 'المهدية', 'الدرعية', 'ظهرة لبن', 'العيينة', 'الجبيلة'].some(d => district.includes(d))) {
            programManager = 'عبدالله علي العنزي';
            subProgram = 'مياه غرب الرياض';
          } else {
            programManager = 'علي الشهري';
            subProgram = 'مياه جنوب الرياض';
          }
        }

        const bestP = this.findBestProject(programManager, report, matchedPoly);
        matchedProject = bestP.projectName;
        fullProjectTitle = bestP.fullTitle || bestP.projectName;
      } else {
        // OUTSIDE KMZ AND NOT AL-ASWAD -> Strictly Maintenance Dept
        department = 'إدارة الصيانة';
        departmentKey = 'maintenance';
        programManager = 'إدارة الصيانة العامة';
        subProgram = 'الشبكات القائمة والمصانة خارج نطاقات المشاريع';
        matchedProject = 'خارج نطاق المشاريع (صيانة)';
        fullProjectTitle = 'خارج نطاق المشاريع (صيانة)';
      }

      // 4. Apply Manual Edit if user previously modified this report
      if (manualEdits[report.id]) {
        const edit = manualEdits[report.id];
        if (edit.programManager) {
          programManager = edit.programManager;
          isProjectContractor = (programManager !== 'إدارة الصيانة العامة');
          department = isProjectContractor ? 'إدارة المشاريع' : 'إدارة الصيانة';
          departmentKey = isProjectContractor ? 'projects' : 'maintenance';
        }
        if (edit.projectName) {
          matchedProject = edit.projectName;
          fullProjectTitle = edit.fullTitle || edit.projectName;
        }
        if (edit.sector) {
          sectorKey = edit.sector === 'الصرف الصحي' ? 'sewer' : 'water';
        }
        if (edit.status) report.status = edit.status;
      }

      const compositeKey = `${sectorKey}_${departmentKey}`;

      return {
        ...report,
        department,
        departmentKey,
        sector,
        sectorKey,
        compositeKey,
        isProjectContractor,
        programManager,
        executiveDirector: 'عبدالله بن ظافر الدوسري',
        matchedProject,
        fullProjectTitle,
        subProgram,
        isAswadContractor
      };
    });

    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`[SpatialEngine] Processed ${reports.length} reports in ${duration}ms with strict KMZ filtering & Al-Aswad rule.`);
    return classifiedReports;
  }

  /**
   * Compute KPIs specifically for Project Contractors and Program Managers
   */
  computeKPIs(reports) {
    const kpis = {
      total: reports.length,
      projectContractorsTotal: 0,
      maintenanceTotal: 0,
      resolved: 0,
      open: 0,
      resolutionRate: '0.0%',
      water: {
        total: 0,
        projects: 0,
        maintenance: 0,
        resolved: 0
      },
      sewer: {
        total: 0,
        projects: 0,
        maintenance: 0,
        resolved: 0
      },
      managers: {}
    };

    // Initialize the 10 managers in KPI map
    this.OFFICIAL_MANAGERS.forEach(m => {
      kpis.managers[m.name] = {
        name: m.name,
        role: m.role,
        sector: m.sector,
        total: 0,
        open: 0,
        resolved: 0
      };
    });

    reports.forEach(r => {
      const isProj = r.isProjectContractor;
      const isSewer = r.sectorKey === 'sewer';
      const isRes = (r.status || '').includes('تمت المعالجة') || (r.status || '').includes('منجز');

      if (isProj) {
        kpis.projectContractorsTotal++;
      } else {
        kpis.maintenanceTotal++;
      }

      if (isRes) {
        kpis.resolved++;
      } else {
        kpis.open++;
      }

      if (isSewer) {
        kpis.sewer.total++;
        if (isProj) kpis.sewer.projects++;
        else kpis.sewer.maintenance++;
        if (isRes) kpis.sewer.resolved++;
      } else {
        kpis.water.total++;
        if (isProj) kpis.water.projects++;
        else kpis.water.maintenance++;
        if (isRes) kpis.water.resolved++;
      }

      // Update manager stats if it's one of the 10
      if (r.programManager && kpis.managers[r.programManager]) {
        kpis.managers[r.programManager].total++;
        if (isRes) {
          kpis.managers[r.programManager].resolved++;
        } else {
          kpis.managers[r.programManager].open++;
        }
      }
    });

    if (kpis.total > 0) {
      kpis.resolutionRate = ((kpis.resolved / kpis.total) * 100).toFixed(1) + '%';
    }

    return kpis;
  }
}

window.SpatialEngine = new SpatialEngine();
