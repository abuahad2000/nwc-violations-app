import { describe, it, expect, afterAll } from 'vitest';
import { classifyWithPostgis, postgis, type ApprovedBoundary } from '@/lib/spatial/postgis';
const boundary: ApprovedBoundary = {
  project_id: 'p1',
  contractor_id: 'c1',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [46, 24],
        [48, 24],
        [48, 26],
        [46, 26],
        [46, 24],
      ],
      [
        [46.5, 24.5],
        [47, 24.5],
        [47, 25],
        [46.5, 25],
        [46.5, 24.5],
      ],
    ],
  },
};
describe.skipIf(!process.env.POSTGIS_URL)('Real PostGIS containment', () => {
  afterAll(async () => {
    await postgis().end();
  });
  it('distinguishes inside, edge, hole, missing coordinates and outside', async () => {
    const result = await classifyWithPostgis(
      [
        { id: 'inside', latitude: 25.5, longitude: 47.5 },
        { id: 'edge', latitude: 25, longitude: 46 },
        { id: 'hole', latitude: 24.7, longitude: 46.7 },
        { id: 'missing', latitude: null, longitude: null },
        { id: 'outside', latitude: 27, longitude: 49 },
      ],
      [boundary],
      true,
    );
    const m = Object.fromEntries(result.map((r) => [r.id, r.classification]));
    expect(m).toEqual({
      inside: 'INSIDE_ACTIVE_PROJECT',
      edge: 'REVIEW_BOUNDARY',
      hole: 'OUTSIDE_ACTIVE_PROJECTS',
      missing: 'REVIEW_COORDINATES',
      outside: 'OUTSIDE_ACTIVE_PROJECTS',
    });
  });
  it('does not classify outside when reference incomplete', async () => {
    expect(
      (await classifyWithPostgis([{ id: 'v', latitude: 27, longitude: 49 }], [boundary], false))[0]
        .classification,
    ).toBe('REVIEW_BOUNDARIES');
  });
  it('detects overlap between distinct projects and not repeated pieces of the same project', async () => {
    const point = [{ id: 'v', latitude: 25.5, longitude: 47.5 }];
    expect(
      (await classifyWithPostgis(point, [boundary, { ...boundary, project_id: 'p2' }], true))[0]
        .classification,
    ).toBe('REVIEW_OVERLAP');
    expect((await classifyWithPostgis(point, [boundary, boundary], true))[0].classification).toBe(
      'INSIDE_ACTIVE_PROJECT',
    );
  });
  it('supports MultiPolygon and cannot assign project to an edge', async () => {
    const multi = {
      ...boundary,
      geometry: {
        type: 'MultiPolygon' as const,
        coordinates: [boundary.geometry.coordinates as number[][][]],
      },
    };
    const result = await classifyWithPostgis(
      [{ id: 'v', latitude: 25, longitude: 46 }],
      [multi],
      true,
    );
    expect(result[0].project_id).toBeNull();
  });
});
