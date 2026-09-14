'use client';

import MapComponent, { type MapComponentProps } from './MapComponent';

/** Public map surface for dashboard pages; MapComponent owns the MapLibre lifecycle. */
export default function MapView(props: MapComponentProps) {
  return <MapComponent {...props} />;
}
