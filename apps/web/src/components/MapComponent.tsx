'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

// MapLibre is browser-only because it creates a WebGL canvas. Keeping the
// import client-only prevents SSR failures in the App Router.
const SpatialMap = dynamic(() => import('./SpatialMap'), {
  ssr: false,
  loading: () => <div className="flex h-[420px] items-center justify-center bg-slate-50 text-slate-500">جارٍ تحميل الخريطة…</div>,
});

export type MapComponentProps = ComponentProps<typeof SpatialMap>;

/** Unified map entry point for active project polygons and clustered violations. */
export default function MapComponent(props: MapComponentProps) {
  return <SpatialMap {...props} />;
}
