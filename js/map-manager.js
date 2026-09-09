/**
 * Map Manager Module - OpenStreetMap Integration
 * Displays KMZ project polygons + Dual-Sector Clustered Markers with Manager Filter & Auto-Zoom
 */

class MapManager {
  constructor() {
    this.map = null;
    this.polygonsLayer = null;
    this.clusterGroup = null;
    this.allMarkers = []; // { marker, report }
    this.selectedManager = 'projects_all';
    this.activeDualFilter = 'all';
  }

  initMap(containerId = 'map') {
    if (this.map) return;

    const defaultCenter = [24.7136, 46.6753];
    const defaultZoom = 11;

    this.map = L.map(containerId, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: false,
      attributionControl: true
    });

    L.control.zoom({ position: 'topleft' }).addTo(this.map);

    // Free OpenStreetMap Standard Tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'ios-osm-tiles',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);

    // Marker Cluster Layer
    this.clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 50,
      chunkDelay: 20,
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        let sizeClass = 'marker-cluster-small';
        let size = 36;
        if (count > 100) {
          sizeClass = 'marker-cluster-large';
          size = 46;
        } else if (count > 20) {
          sizeClass = 'marker-cluster-medium';
          size = 40;
        }
        return new L.DivIcon({
          html: `<div><span>${count}</span></div>`,
          className: `marker-cluster ${sizeClass}`,
          iconSize: new L.Point(size, size)
        });
      }
    });

    this.map.addLayer(this.clusterGroup);
  }

  renderBoundaries(geojson) {
    if (!this.map) return;

    if (this.polygonsLayer) {
      this.map.removeLayer(this.polygonsLayer);
    }

    this.polygonsLayer = L.geoJSON(geojson, {
      style: (feature) => {
        const isSewer = (feature.properties?.source || '').includes('صرف') || (feature.properties?.name || '').includes('صرف');
        const color = isSewer ? '#5856D6' : '#007AFF';
        return {
          color: color,
          weight: 2.5,
          opacity: 0.9,
          fillColor: color,
          fillOpacity: 0.18,
          dashArray: '5, 5'
        };
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties?.name || 'نطاق مشروع جاري';
        const src = feature.properties?.source || '';
        const isSewer = src.includes('صرف') || name.includes('صرف');
        const sectorLabel = isSewer ? '🚰 قطاع الصرف الصحي' : '💧 قطاع شبكات المياه';
        const color = isSewer ? '#5856D6' : '#007AFF';

        layer.bindTooltip(`
          <div style="font-family: 'Cairo', sans-serif; text-align: right; direction: rtl; font-size: 0.85rem; font-weight: 700; color: #1C1C1E; padding: 4px;">
            <div style="color: ${color}; font-size: 0.78rem; font-weight: 800;">${sectorLabel}</div>
            <div style="font-size: 0.9rem; margin-top: 2px;">${name}</div>
            <div style="font-size: 0.72rem; color: #8E8E93; font-weight: 500; margin-top: 2px;">نطاق معتمد: ${src}</div>
          </div>
        `, {
          sticky: true,
          className: 'ios-glass-tooltip',
          direction: 'top'
        });

        layer.on({
          mouseover: (e) => {
            e.target.setStyle({ weight: 4, fillOpacity: 0.38, dashArray: '' });
          },
          mouseout: (e) => {
            this.polygonsLayer.resetStyle(e.target);
          }
        });
      }
    });

    this.polygonsLayer.addTo(this.map);
  }

  renderReports(reports) {
    if (!this.map || !this.clusterGroup) return;

    this.clusterGroup.clearLayers();
    this.allMarkers = [];

    const newMarkers = [];

    reports.forEach(report => {
      const isProject = report.departmentKey === 'projects';
      const isSewer = report.sectorKey === 'sewer';

      let pinClass = 'pin-water-maint';
      let iconSymbol = '💧';

      if (isSewer && isProject) {
        pinClass = 'pin-sewer-proj';
        iconSymbol = '🏗️';
      } else if (isSewer && !isProject) {
        pinClass = 'pin-sewer-maint';
        iconSymbol = '🔧';
      } else if (!isSewer && isProject) {
        pinClass = 'pin-water-proj';
        iconSymbol = '🏗️';
      } else {
        pinClass = 'pin-water-maint';
        iconSymbol = '💧';
      }

      const customIcon = L.divIcon({
        className: 'custom-pin-container',
        html: `<div class="custom-pin ${pinClass}" title="بلاغ: ${report.id} (${report.programManager})">${iconSymbol}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([report.lat, report.lng], { icon: customIcon });

      marker.on('click', () => {
        if (window.ActionSheetInstance) {
          window.ActionSheetInstance.open(report);
        }
      });

      this.allMarkers.push({ marker, report });
      newMarkers.push(marker);
    });

    this.filterMarkers();
  }

  filterMarkers() {
    if (!this.clusterGroup) return;
    this.clusterGroup.clearLayers();

    const visibleMarkers = [];
    const visibleReports = [];

    this.allMarkers.forEach(item => {
      const r = item.report;

      // 1. Manager Filter
      if (this.selectedManager === 'projects_all') {
        if (!r.isProjectContractor) return;
      } else if (this.selectedManager === 'maintenance_all') {
        if (r.isProjectContractor) return;
      } else if (this.selectedManager !== 'all') {
        if (r.programManager !== this.selectedManager) return;
      }

      // 2. Dual Classification Filter
      if (this.activeDualFilter !== 'all') {
        if (this.activeDualFilter === 'water_projects' && (r.sectorKey !== 'water' || r.departmentKey !== 'projects')) return;
        if (this.activeDualFilter === 'water_maintenance' && (r.sectorKey !== 'water' || r.departmentKey !== 'maintenance')) return;
        if (this.activeDualFilter === 'sewer_projects' && (r.sectorKey !== 'sewer' || r.departmentKey !== 'projects')) return;
        if (this.activeDualFilter === 'sewer_maintenance' && (r.sectorKey !== 'sewer' || r.departmentKey !== 'maintenance')) return;
      }

      visibleMarkers.push(item.marker);
      visibleReports.push(r);
    });

    this.clusterGroup.addLayers(visibleMarkers);

    if (visibleReports.length > 0) {
      this.fitBoundsToReports(visibleReports);
    }
  }

  setManagerFilter(managerKey) {
    this.selectedManager = managerKey;
    this.filterMarkers();
  }

  setDualFilter(dualFilterKey) {
    this.activeDualFilter = dualFilterKey;
    this.filterMarkers();
  }

  fitBoundsToReports(reports) {
    if (!this.map || !reports || reports.length === 0) return;

    const latLngs = reports.map(r => [r.lat, r.lng]);
    const bounds = L.latLngBounds(latLngs);
    if (bounds.isValid()) {
      this.map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 14,
        animate: true
      });
    }
  }

  focusReport(report) {
    if (!this.map || !report) return;
    this.map.flyTo([report.lat, report.lng], 16, {
      duration: 1.2,
      easeLinearity: 0.25
    });
    if (window.ActionSheetInstance) {
      window.ActionSheetInstance.open(report);
    }
  }
}

window.MapManager = new MapManager();
