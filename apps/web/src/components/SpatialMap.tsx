'use client';
import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { serviceLabels, serviceColors, type ServiceType } from '@/lib/domain/service-type';
function escapeHtml(value: unknown): string {
  return String(value ?? 'غير محدد').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character);
}
function popupColor(status: string): string {
  if (status.includes('تمت') || status.includes('معالج')) return '#059669';
  if (status.includes('مقاول')) return '#d97706';
  return '#dc2626';
}
export default function SpatialMap({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const select = useRef(onSelect);
  const [service, setService] = useState<ServiceType | 'ALL'>('ALL');
  const [boundaryCount, setBoundaryCount] = useState(0);
  const [status, setStatus] = useState('ALL');
  const [statusCounts, setStatusCounts] = useState({
    all: 0,
    pending: 0,
    contractor: 0,
    closed: 0,
  });
  const [visiblePoints, setVisiblePoints] = useState<FeatureCollection['features']>([]);
  const extent = useRef<maplibregl.LngLatBounds | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [rendered, setRendered] = useState(false);
  const [basemap, setBasemap] = useState<'osm' | 'voyager' | 'dark'>('osm');
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    if (!host.current) return;
    const m = new maplibregl.Map({
      container: host.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: [
              process.env.NEXT_PUBLIC_OSM_TILE_URL ||
                'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
          },
          voyager: { type: 'raster', tiles: ['https://{a-c}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors · © CARTO' },
          dark: { type: 'raster', tiles: ['https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors · © CARTO' },
        },
        layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#edf3f5' } },
          {
            id: 'osm-streets',
            type: 'raster',
            source: 'osm',
            paint: { 'raster-saturation': -0.65, 'raster-contrast': -0.1 },
          },
          { id: 'voyager-basemap', type: 'raster', source: 'voyager', layout: { visibility: 'none' } },
          { id: 'dark-basemap', type: 'raster', source: 'dark', layout: { visibility: 'none' } },
        ],
      },
      center: [46.68, 24.72],
      zoom: 9,
      attributionControl: { compact: false },
    });
    map.current = m;
    const observer = new ResizeObserver(() => m.resize());
    observer.observe(host.current);
    m.addControl(new maplibregl.NavigationControl(), 'top-left');
    m.on('load', () => {
      m.resize();
      setReady(true);
    });
    m.on('error', () => setError('تعذر عرض طبقة الخريطة'));
    return () => {
      observer.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    const controller = new AbortController();
    const m = map.current;
    fetch(`/api/map?${query}`, { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message);
        return d as { points: FeatureCollection; boundaries: FeatureCollection };
      })
      .then((d) => {
        if (service !== 'ALL') {
          d.points.features = d.points.features.filter(
            (f) => f.properties?.service_type === service,
          );
          d.boundaries.features = d.boundaries.features.filter(
            (f) => f.properties?.service_type === service,
          );
        }
        setBoundaryCount(d.boundaries.features.length);
        setStatusCounts({
          all: d.points.features.length,
          pending: d.points.features.filter((f) => !f.properties?.is_closed).length,
          contractor: d.points.features.filter(
            (f) => !f.properties?.is_closed && f.properties?.source_status === 'تحت معالجة المقاول',
          ).length,
          closed: d.points.features.filter((f) => !!f.properties?.is_closed).length,
        });
        d.points.features = d.points.features.filter(
          (f) =>
            status === 'ALL' ||
            (status === 'CLOSED'
              ? !!f.properties?.is_closed
              : status === 'PENDING'
                ? !f.properties?.is_closed
                : !f.properties?.is_closed && f.properties?.source_status === 'تحت معالجة المقاول'),
        );
        setVisiblePoints(d.points.features);
        const bounds = new maplibregl.LngLatBounds();
        for (const f of d.points.features)
          if (f.geometry.type === 'Point')
            bounds.extend(f.geometry.coordinates as [number, number]);
        extent.current = bounds.isEmpty() ? null : bounds;
        setError('');
        setCount(d.points.features.length);
        setRendered(false);
        m.once('idle', () => setRendered(true));
        if (m.getSource('points')) {
          (m.getSource('points') as maplibregl.GeoJSONSource).setData(d.points);
          (m.getSource('boundaries') as maplibregl.GeoJSONSource).setData(d.boundaries);
          return;
        }
        m.addSource('boundaries', { type: 'geojson', data: d.boundaries });
        m.addLayer({
          id: 'boundaries-fill',
          type: 'fill',
          source: 'boundaries',
          paint: {
            'fill-color': [
              'match',
              ['get', 'service_type'],
              'WATER',
              serviceColors.WATER,
              'SEWER',
              serviceColors.SEWER,
              'MIXED',
              serviceColors.MIXED,
              serviceColors.UNKNOWN,
            ],
            'fill-opacity': 0.14,
          },
        });
        m.addLayer({
          id: 'boundaries-line',
          type: 'line',
          source: 'boundaries',
          paint: {
            'line-color': [
              'match',
              ['get', 'service_type'],
              'WATER',
              serviceColors.WATER,
              'SEWER',
              serviceColors.SEWER,
              'MIXED',
              serviceColors.MIXED,
              serviceColors.UNKNOWN,
            ],
            'line-width': 2,
            'line-dasharray': [2, 2],
          },
        });
        m.addLayer({
          id: 'boundaries-highlight',
          type: 'line',
          source: 'boundaries',
          paint: { 'line-color': '#fbbf24', 'line-width': 4, 'line-opacity': 0 },
        });
        m.on('click', 'boundaries-fill', (event) => {
          const feature = event.features?.[0];
          const projectId = feature?.properties?.project_id;
          if (!projectId || feature?.geometry.type !== 'Polygon' && feature?.geometry.type !== 'MultiPolygon') return;
          m.flyTo({ center: event.lngLat, zoom: Math.max(m.getZoom(), 13), speed: 0.8, essential: true });
          m.setPaintProperty('boundaries-highlight', 'line-opacity', ['case', ['==', ['get', 'project_id'], String(projectId)], 1, 0]);
        });
        m.on('mouseenter', 'boundaries-fill', () => { m.getCanvas().style.cursor = 'pointer'; });
        m.on('mouseleave', 'boundaries-fill', () => { m.getCanvas().style.cursor = ''; });
        m.addSource('points', {
          type: 'geojson',
          data: d.points,
          cluster: true,
          clusterRadius: 35,
          clusterMaxZoom: 12,
        });
        m.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'points',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#0f2744',
            'circle-radius': ['step', ['get', 'point_count'], 13, 50, 20, 500, 28],
            'circle-opacity': 0.85,
          },
        });
        m.addLayer({
          id: 'points-layer',
          type: 'circle',
          source: 'points',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': [
              'case',
              ['==', ['get', 'is_closed'], 1],
              '#059669',
              ['==', ['get', 'source_status'], 'تحت معالجة المقاول'],
              '#2563eb',
              '#f59e0b',
            ],
            'circle-radius': 6,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          },
        });
        m.on('click', 'points-layer', (e) => {
          const feature = e.features?.[0];
          const properties = feature?.properties;
          const id = properties?.id;
          if (!id || feature?.geometry.type !== 'Point') return;
          select.current(String(id));
          const statusText = String(properties?.source_status || 'غير محدد');
          const projectId = properties?.project_id ? String(properties.project_id) : '';
          const coordinates = feature.geometry.coordinates as [number, number];
          const exportButton = projectId
            ? `<a href="/api/export/kmz/${encodeURIComponent(projectId)}" class="map-popup-export">تصدير KMZ للمشروع المرتبط</a>`
            : '<span class="map-popup-muted">لا يوجد مشروع جاري مرتبط</span>';
          new maplibregl.Popup({ closeButton: true, maxWidth: '320px', offset: 12 })
            .setLngLat(coordinates)
            .setHTML(
              `<div dir="rtl" class="map-popup-content"><h4>بلاغ ${escapeHtml(properties.reference)}</h4><span class="map-popup-status" style="background:${popupColor(statusText)}">${escapeHtml(statusText)}</span><dl><dt>المقاول</dt><dd>${escapeHtml(properties.contractor_name)}</dd><dt>الحي</dt><dd>${escapeHtml(properties.district)}</dd><dt>الشارع</dt><dd>${escapeHtml(properties.street)}</dd></dl>${exportButton}</div>`,
            )
            .addTo(m);
        });
        for (const layer of ['points-layer', 'clusters']) {
          m.on('mouseenter', layer, () => {
            m.getCanvas().style.cursor = 'pointer';
          });
          m.on('mouseleave', layer, () => {
            m.getCanvas().style.cursor = '';
          });
        }
        m.on('click', 'clusters', (e) => {
          if (e.features?.[0]?.geometry.type === 'Point')
            m.easeTo({
              center: e.features[0].geometry.coordinates as [number, number],
              zoom: m.getZoom() + 2,
            });
        });
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, [query, ready, service, status]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const m = map.current;
    for (const id of ['osm-streets', 'voyager-basemap', 'dark-basemap']) m.setLayoutProperty(id, 'visibility', id === `${basemap === 'osm' ? 'osm-streets' : `${basemap}-basemap`}` ? 'visible' : 'none');
  }, [basemap, ready]);

  return (
    <section className="card surface overflow-hidden" aria-label="خريطة الخدمات والبلاغات">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-[#182433] p-5 text-white">
        <div>
          <p className="mb-1 text-sm text-cyan-200">المياه والصرف الصحي · OpenStreetMap</p>
          <h3 className="text-xl font-bold text-white">
            التوزيع المكاني {count !== null ? '(' + count + ' نقطة)' : '— جارٍ التحميل'}
          </h3>
        </div>
        <button
          className="btn secondary text-slate-800"
          disabled={!count}
          onClick={() => {
            if (extent.current)
              map.current?.fitBounds(extent.current, { padding: 50, maxZoom: 15 });
          }}
        >
          عرض جميع النقاط
        </button>
      </header>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white/70 p-4 text-sm">
        <label htmlFor="basemap-theme" className="font-semibold text-slate-700">نمط الخريطة</label>
        <select id="basemap-theme" value={basemap} onChange={(event) => setBasemap(event.target.value as typeof basemap)} className="field h-10 rounded-xl px-3">
          <option value="osm">OpenStreetMap — واضح</option>
          <option value="voyager">OSM Voyager — ملون</option>
          <option value="dark">OSM Dark — داكن</option>
        </select>
        <span className="text-xs text-slate-500">تتضمن أسماء الشوارع · © OpenStreetMap contributors</span>
      </div>
      <div
        role="tablist"
        aria-label="نوع المشروع على الخريطة"
        className="flex flex-wrap gap-2 border-b border-slate-200 bg-white p-4"
      >
        {([['ALL', 'الكل'], ...Object.entries(serviceLabels)] as [string, string][]).map(
          ([value, label], i) => (
            <button
              key={value}
              id={'map-tab-' + value}
              role="tab"
              aria-selected={service === value}
              aria-controls="map-service-panel"
              tabIndex={service === value ? 0 : -1}
              onKeyDown={(e) => {
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                  e.preventDefault();
                  const tabs = Array.from(
                    e.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                      '[role=tab]',
                    ),
                  );
                  const next =
                    e.key === 'Home'
                      ? 0
                      : e.key === 'End'
                        ? tabs.length - 1
                        : (i + (e.key === 'ArrowLeft' ? 1 : -1) + tabs.length) % tabs.length;
                  tabs[next].focus();
                  tabs[next].click();
                }
              }}
              onClick={() => setService(value as ServiceType | 'ALL')}
              className={
                'rounded-xl px-5 py-2.5 text-sm font-bold transition ' +
                (service === value
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-blue-50')
              }
            >
              {label}
            </button>
          ),
        )}
      </div>
      <div id="map-service-panel" role="tabpanel" aria-labelledby={'map-tab-' + service}>
        <div
          className="grid grid-cols-2 gap-3 bg-slate-50 p-4 lg:grid-cols-4"
          aria-label="تصفية حالة البلاغ على الخريطة"
        >
          {(
            [
              ['ALL', 'جميع البلاغات', statusCounts.all],
              ['PENDING', 'معلّق / مفتوح', statusCounts.pending],
              ['CONTRACTOR', 'تحت معالجة المقاول', statusCounts.contractor],
              ['CLOSED', 'تمت المعالجة', statusCounts.closed],
            ] as const
          ).map(([key, label, value]) => (
            <button
              key={key}
              aria-pressed={status === key}
              onClick={() => setStatus(key)}
              className={
                'rounded-xl border bg-white p-3 text-start ' +
                (status === key ? 'border-blue-600 ring-1 ring-blue-600' : 'border-slate-200')
              }
            >
              <span className="block text-sm text-slate-600">{label}</span>
              <strong className="text-2xl text-slate-900">{value.toLocaleString('ar-SA')}</strong>
            </button>
          ))}
        </div>
        <p className="px-4 pb-3 text-sm text-slate-500">
          تبويبات النوع والحالة تخص الخريطة فقط. تحت معالجة المقاول جزء من المفتوح. {boundaryCount}{' '}
          نطاق معتمد ظاهر.
        </p>
        {error && (
          <p role="alert" className="notice-error">
            {error}
          </p>
        )}
        {count === 0 && (
          <p className="p-4 text-sm" role="status">
            لا توجد نقاط تعديات مطابقة على الخريطة.
          </p>
        )}
        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
          <div
            data-map-ready={rendered}
            ref={host}
            aria-label="خريطة التعديات؛ التفاصيل متاحة أيضًا في الجدول"
            className="h-[420px] w-full sm:h-[540px]"
          />
          <aside
            className="max-h-[540px] overflow-y-auto border-s border-slate-200 bg-slate-50 p-3"
            aria-label="قائمة البلاغات الظاهرة"
          >
            <h4 className="mb-3 font-bold">البلاغات على الخريطة</h4>
            <div className="space-y-2">
              {visiblePoints.slice(0, 30).map((f) => (
                <button
                  key={String(f.properties?.id)}
                  onClick={() => select.current(String(f.properties?.id))}
                  className="block w-full rounded-xl border border-slate-200 bg-white p-3 text-start hover:border-blue-500"
                >
                  <bdi className="font-bold text-blue-800">{String(f.properties?.reference)}</bdi>
                  <span
                    className={
                      'mt-2 block text-sm ' +
                      (f.properties?.is_closed
                        ? 'text-emerald-700'
                        : f.properties?.source_status === 'تحت معالجة المقاول'
                          ? 'text-blue-700'
                          : 'text-amber-800')
                    }
                  >
                    {String(f.properties?.source_status || 'غير محدد')}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {String(f.properties?.project_name || 'بلا مشروع مرتبط')}
                  </span>
                </button>
              ))}
            </div>
            {visiblePoints.length > 30 && (
              <p className="mt-3 text-xs text-slate-500">
                عرض أول ٣٠ بلاغًا من {visiblePoints.length.toLocaleString('ar-SA')}؛ جميع النقاط
                متاحة على الخريطة.
              </p>
            )}
          </aside>
        </div>
      </div>
      <footer className="flex flex-wrap gap-4 border-t border-slate-200 p-4 text-sm text-slate-600">
        <span>🟢 تمت المعالجة</span>
        <span>🔵 تحت معالجة المقاول</span>
        <span>🟠 بقية المفتوح</span>
        <span>حدود المياه أزرق · الصرف أخضر</span>
      </footer>
      <div className="flex flex-wrap gap-4 border-t border-slate-100 bg-white px-4 py-3 text-xs text-slate-600" aria-label="مفتاح ألوان الخريطة">
        <span><i className="me-1 inline-block h-3 w-3 rounded-full bg-red-600" />معلّق / مفتوح</span>
        <span><i className="me-1 inline-block h-3 w-3 rounded-full bg-amber-600" />تحت معالجة المقاول</span>
        <span><i className="me-1 inline-block h-3 w-3 rounded-full bg-emerald-600" />تمت المعالجة</span>
        <span><i className="me-1 inline-block h-3 w-3 rounded-sm bg-blue-600/30 ring-1 ring-blue-600" />نطاق مشروع</span>
      </div>
    </section>
  );
}
maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
