/**
 * KMZ / KML Loader Module
 * Automatically loads pre-configured project boundaries and supports dynamic KMZ/KML uploads.
 */

class KMZLoader {
  constructor() {
    this.currentGeoJSON = null;
  }

  /**
   * Automatically loads default project boundaries from data/projects_boundaries.geojson
   */
  async loadDefaultBoundaries() {
    try {
      console.log('[KMZLoader] Fetching default projects_boundaries.geojson...');
      const response = await fetch('data/projects_boundaries.geojson');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      this.currentGeoJSON = data;
      console.log(`[KMZLoader] Successfully loaded ${data.features.length} project boundaries.`);
      return data;
    } catch (err) {
      console.warn('[KMZLoader] Error loading default geojson:', err);
      return null;
    }
  }

  /**
   * Parse a KML string into a GeoJSON FeatureCollection
   * @param {string} kmlText - The raw KML XML string
   * @param {string} sourceName - Source name for metadata
   * @returns {Object} GeoJSON FeatureCollection
   */
  parseKML(kmlText, sourceName = 'Custom KML') {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
    const placemarks = xmlDoc.getElementsByTagName('Placemark');
    const features = [];
    let polyId = 1;

    for (let i = 0; i < placemarks.length; i++) {
      const pm = placemarks[i];
      const nameEl = pm.getElementsByTagName('name')[0];
      const name = nameEl ? nameEl.textContent.trim() : 'مشروع مخصص';

      const descEl = pm.getElementsByTagName('description')[0];
      const desc = descEl ? descEl.textContent.trim() : '';

      const polygons = pm.getElementsByTagName('Polygon');
      for (let j = 0; j < polygons.length; j++) {
        const poly = polygons[j];
        const outer = poly.getElementsByTagName('outerBoundaryIs')[0];
        if (!outer) continue;

        const coordsEl = outer.getElementsByTagName('coordinates')[0];
        if (!coordsEl || !coordsEl.textContent) continue;

        const rawPoints = coordsEl.textContent.trim().split(/\s+/);
        const ring = [];

        for (const ptStr of rawPoints) {
          const parts = ptStr.split(',');
          if (parts.length >= 2) {
            const lng = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            if (!isNaN(lng) && !isNaN(lat)) {
              ring.push([lng, lat]);
            }
          }
        }

        if (ring.length >= 3) {
          features.push({
            type: 'Feature',
            id: polyId,
            properties: {
              id: polyId,
              name: name,
              description: desc,
              source: sourceName
            },
            geometry: {
              type: 'Polygon',
              coordinates: [ring]
            }
          });
          polyId++;
        }
      }
    }

    const geojson = {
      type: 'FeatureCollection',
      totalFeatures: features.length,
      features: features
    };

    this.currentGeoJSON = geojson;
    return geojson;
  }

  /**
   * Parse an uploaded KMZ or KML File
   * @param {File} file - Browser File object
   * @returns {Promise<Object>} GeoJSON FeatureCollection
   */
  async parseKMZFile(file) {
    const fileName = file.name;
    const isKmz = fileName.toLowerCase().endsWith('.kmz');

    if (isKmz) {
      if (typeof JSZip === 'undefined') {
        throw new Error('JSZip library is not loaded');
      }
      const zip = await JSZip.loadAsync(file);
      // Look for doc.kml or any .kml file
      let kmlFile = zip.file('doc.kml');
      if (!kmlFile) {
        const kmlKeys = Object.keys(zip.files).filter(k => k.toLowerCase().endsWith('.kml'));
        if (kmlKeys.length > 0) {
          kmlFile = zip.file(kmlKeys[0]);
        }
      }

      if (!kmlFile) {
        throw new Error('لم يتم العثور على ملف KML داخل أرشيف KMZ');
      }

      const kmlText = await kmlFile.async('string');
      return this.parseKML(kmlText, fileName);
    } else {
      // Plain KML file
      const kmlText = await file.text();
      return this.parseKML(kmlText, fileName);
    }
  }
}

window.KMZLoader = new KMZLoader();
