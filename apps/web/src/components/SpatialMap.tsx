'use client';
import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
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
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [rendered, setRendered] = useState(false);
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
        },
        layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#edf3f5' } },
          {
            id: 'osm-streets',
            type: 'raster',
            source: 'osm',
            paint: { 'raster-saturation': -0.35 },
          },
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
          paint: { 'fill-color': '#0e7c86', 'fill-opacity': 0.09 },
        });
        m.addLayer({
          id: 'boundaries-line',
          type: 'line',
          source: 'boundaries',
          paint: { 'line-color': '#0e7c86', 'line-width': 1.5, 'line-dasharray': [2, 2] },
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
              'match',
              ['get', 'classification'],
              'INSIDE_PROJECT_BOUNDARY',
              '#0e7c86',
              'OUTSIDE_PROJECT_BOUNDARY',
              '#2563eb',
              '#d97706',
            ],
            'circle-radius': 6,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          },
        });
        m.on('click', 'points-layer', (e) => {
          const id = e.features?.[0]?.properties.id;
          if (id) select.current(String(id));
        });
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
  }, [query, ready]);
  return (
    <section className="surface overflow-hidden">
      <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 p-4">
        <h3 className="font-semibold">
          التوزيع المكاني {count !== null ? `(${count} نقطة)` : '— جارٍ التحميل'}
        </h3>
        <span className="text-sm text-slate-500">أخضر: داخل · أزرق: خارج · برتقالي: مراجعة</span>
      </div>
      {error && (
        <p role="alert" className="notice-error">
          {error}
        </p>
      )}
      <div
        data-map-ready={rendered}
        ref={host}
        aria-label="خريطة التعديات؛ التفاصيل متاحة أيضًا في الجدول"
        className="h-[360px] w-full sm:h-[440px]"
      />
      <p className="p-3 text-xs text-slate-500">
        خريطة الشوارع من OpenStreetMap. الحدود المتقطعة للمشاريع المعتمدة؛ اضغط على مجموعة لتكبيرها
        أو نقطة لعرض التفاصيل.
      </p>
    </section>
  );
}
