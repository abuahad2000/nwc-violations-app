'use client';

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { serviceLabels, serviceColors, type ServiceType } from '@/lib/domain/service-type';

function escapeHtml(value: unknown): string {
  return String(value ?? 'غير محدد').replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ||
      character,
  );
}

function popupColor(status: string): string {
  if (status.includes('تمت') || status.includes('معالج')) return '#059669';
  if (status.includes('مقاول')) return '#d97706';
  return '#dc2626';
}

// دالة لإنشاء الـ Style بناءً على النمط المختار
function getMapStyle(basemap: 'osm' | 'voyager' | 'dark'): maplibregl.Style {
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: [
          process.env.NEXT_PUBLIC_OSM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© OpenStreetMap contributors',
      },
      voyager: {
        type: 'raster',
        tiles: ['https://{a-c}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap · © CARTO',
      },
      dark: {
        type: 'raster',
        tiles: ['https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap · © CARTO',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#f8fafc' } },
      {
        id: 'osm-streets',
        type: 'raster',
        source: 'osm',
        paint: { 'raster-saturation': 0.2, 'raster-contrast': 0.1 },
      },
      {
        id: 'voyager-basemap',
        type: 'raster',
        source: 'voyager',
        layout: { visibility: basemap === 'voyager' ? 'visible' : 'none' },
      },
      {
        id: 'dark-basemap',
        type: 'raster',
        source: 'dark',
        layout: { visibility: basemap === 'dark' ? 'visible' : 'none' },
      },
    ],
  };
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
  const [basemap, setBasemap] = useState<'osm' | 'voyager' | 'dark'>('voyager');

  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  // إنشاء الخريطة
  useEffect(() => {
    if (!host.current) return;

    const m = new maplibregl.Map({
      container: host.current,
      style: getMapStyle(basemap),
      center: [46.68, 24.72],
      zoom: 9,
      attributionControl: { compact: true },
    });

    map.current = m;
    const observer = new ResizeObserver(() => m.resize());
    observer.observe(host.current);
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

    m.on('load', () => {
      m.resize();
      setReady(true);
    });

    m.on('error', (e) => {
      console.error('Map error:', e);
      setError('تعذر عرض طبقة الخريطة');
    });

    return () => {
      observer.disconnect();
      m.remove();
      map.current = null;
    };
  }, []); // ✅ مهم: فارغ لإنشاء الخريطة مرة واحدة فقط

  // ✅ تحديث نمط الخريطة عند تغيير basemap
  useEffect(() => {
    if (!map.current) return;

    // تغيير الـ style بالكامل
    map.current.setStyle(getMapStyle(basemap));

    // إعادة تحميل البيانات بعد تغيير الـ style
    map.current.once('style.load', () => {
      setReady(false); // إعادة تحميل البيانات
    });
  }, [basemap]);

  // تحميل البيانات
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
        for (const f of d.points.features) {
          if (f.geometry.type === 'Point')
            bounds.extend(f.geometry.coordinates as [number, number]);
        }
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
            'fill-opacity': 0.25,
          },
        });
        m.addLayer({
          id: 'boundaries-line',
          type: 'line',
          source: 'boundaries',
          paint: { 'line-color': '#2563eb', 'line-width': 2, 'line-dasharray': [3, 3] },
        });

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
            'circle-color': '#1e40af',
            'circle-radius': ['step', ['get', 'point_count'], 14, 50, 22, 500, 30],
            'circle-opacity': 0.9,
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
              '#f59e0b',
              ['==', ['get', 'source_status'], 'تحت معالجة الجهة المتعدية'],
              '#3b82f6',
              '#ef4444',
            ],
            'circle-radius': 5,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
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
            ? `<a href="/api/export/kmz/${encodeURIComponent(projectId)}" style="display:block; margin-top:10px; background:#2563eb; color:white; text-align:center; padding:8px; border-radius:6px; text-decoration:none; font-size:12px; font-weight:bold;">تصدير KMZ للمشروع</a>`
            : '<span style="display:block; margin-top:10px; color:#64748b; font-size:12px;">لا يوجد مشروع جاري مرتبط</span>';

          new maplibregl.Popup({ closeButton: true, maxWidth: '300px', offset: 12 })
            .setLngLat(coordinates)
            .setHTML(
              `<div dir="rtl" style="font-family: 'Noto Sans Arabic', sans-serif; color: #1e293b;">
                <h4 style="margin:0 0 8px; font-size:15px; font-weight:800;">بلاغ ${escapeHtml(properties.reference)}</h4>
                <span style="display:inline-block; background:${popupColor(statusText)}; color:white; padding:3px 8px; border-radius:99px; font-size:11px; font-weight:700; margin-bottom:10px;">${escapeHtml(statusText)}</span>
                <dl style="display:grid; grid-template-columns:70px 1fr; gap:6px 8px; margin:0; font-size:13px;">
                  <dt style="color:#64748b; font-weight:600;">المقاول</dt><dd style="margin:0; font-weight:700;">${escapeHtml(properties.contractor_name)}</dd>
                  <dt style="color:#64748b; font-weight:600;">الحي</dt><dd style="margin:0; font-weight:700;">${escapeHtml(properties.district)}</dd>
                </dl>
                ${exportButton}
              </div>`,
            )
            .addTo(m);
        });

        m.on('click', 'clusters', (e) => {
          if (e.features?.[0]?.geometry.type === 'Point') {
            m.easeTo({
              center: e.features[0].geometry.coordinates as [number, number],
              zoom: m.getZoom() + 2,
            });
          }
        });
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, [query, ready, service, status]);

  return (
    <section className="card-glass overflow-hidden" aria-label="خريطة الخدمات والبلاغات">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-800 to-slate-900 p-5 text-white">
        <div>
          <p className="mb-1 text-xs text-blue-200">المياه والصرف الصحي · OpenStreetMap</p>
          <h3 className="text-lg font-bold text-white">
            التوزيع المكاني {count !== null ? `(${count} نقطة)` : '— جارٍ التحميل'}
          </h3>
        </div>
        <button
          className="btn-secondary text-sm"
          disabled={!count}
          onClick={() => {
            if (extent.current)
              map.current?.fitBounds(extent.current, { padding: 50, maxZoom: 15 });
          }}
        >
          عرض جميع النقاط
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white/80 p-4 text-sm backdrop-blur-sm">
        <label htmlFor="basemap-theme" className="font-semibold text-slate-700">
          نمط الخريطة:
        </label>
        <select
          id="basemap-theme"
          value={basemap}
          onChange={(e) => setBasemap(e.target.value as typeof basemap)}
          className="input-field w-auto h-10"
        >
          <option value="voyager">️ خريطة واضحة (موصى به)</option>
          <option value="osm">🌍 OpenStreetMap كلاسيكي</option>
          <option value="dark">🌙 الوضع الداكن</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-white p-4">
        {([['ALL', 'الكل'], ...Object.entries(serviceLabels)] as [string, string][]).map(
          ([value, label]) => (
            <button
              key={value}
              onClick={() => setService(value as ServiceType | 'ALL')}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                service === value
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-blue-50'
              }`}
            >
              {label}
            </button>
          ),
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-4 lg:grid-cols-4">
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
            onClick={() => setStatus(key)}
            className={`rounded-xl border bg-white p-3 text-start transition ${
              status === key
                ? 'border-blue-500 ring-1 ring-blue-500 shadow-sm'
                : 'border-slate-200 hover:border-blue-300'
            }`}
          >
            <span className="block text-xs text-slate-500">{label}</span>
            <strong className="text-xl text-slate-800">{value.toLocaleString('ar-SA')}</strong>
          </button>
        ))}
      </div>

      {error && <p className="p-4 text-center text-red-600">{error}</p>}

      <div className="grid lg:grid-cols-[1fr_280px]">
        <div ref={host} className="h-[450px] w-full sm:h-[550px]" />
        <aside className="max-h-[550px] overflow-y-auto border-s border-slate-200 bg-slate-50/80 p-4 backdrop-blur-sm">
          <h4 className="mb-3 text-sm font-bold text-slate-700">البلاغات الظاهرة</h4>
          <div className="space-y-2">
            {visiblePoints.slice(0, 30).map((f) => (
              <button
                key={String(f.properties?.id)}
                onClick={() => select.current(String(f.properties?.id))}
                className="block w-full rounded-xl border border-slate-200 bg-white p-3 text-start transition hover:border-blue-400 hover:shadow-sm"
              >
                <bdi className="font-bold text-blue-700">{String(f.properties?.reference)}</bdi>
                <span
                  className={`mt-1 block text-xs font-medium ${
                    f.properties?.is_closed
                      ? 'text-emerald-600'
                      : f.properties?.source_status === 'تحت معالجة المقاول'
                        ? 'text-amber-600'
                        : 'text-red-600'
                  }`}
                >
                  {String(f.properties?.source_status || 'غير محدد')}
                </span>
              </button>
            ))}
          </div>
          {visiblePoints.length > 30 && (
            <p className="mt-3 text-center text-xs text-slate-500">
              عرض أول ٠ بلاغًا من {visiblePoints.length.toLocaleString('ar-SA')}
            </p>
          )}
          {visiblePoints.length === 0 && (
            <p className="text-center text-sm text-slate-500">لا توجد نقاط</p>
          )}
        </aside>
      </div>
    </section>
  );
}

maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
