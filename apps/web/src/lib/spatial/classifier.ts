import { ClassificationResult, Project, ProjectBoundary } from '@/types';

/**
 * Checks if a point is strictly on a segment or within a tolerance boundary
 */
function isPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  epsilon = 1e-7,
): boolean {
  const squaredLength = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
  if (squaredLength < 1e-14) {
    // Degenerate zero-length segment (e.g. closing ring duplicate vertex)
    return false;
  }

  const crossProduct = (py - ay) * (bx - ax) - (px - ax) * (by - ay);
  if (Math.abs(crossProduct) > epsilon) return false;

  const dotProduct = (px - ax) * (bx - ax) + (py - ay) * (by - ay);
  if (dotProduct < -epsilon) return false;
  if (dotProduct > squaredLength + epsilon) return false;

  return true;
}

/**
 * Standard ray-casting algorithm for Point in Polygon with hole support and boundary detection.
 * Returns: 'INSIDE' | 'BOUNDARY' | 'OUTSIDE'
 */
export function pointInPolygon(
  point: [number, number], // [lng, lat]
  ring: number[][], // array of [lng, lat]
): 'INSIDE' | 'BOUNDARY' | 'OUTSIDE' {
  const [x, y] = point;
  let inside = false;
  let onBoundary = false;
  const n = ring.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    // Check if point is on the edge
    if (isPointOnSegment(x, y, xi, yi, xj, yj)) {
      onBoundary = true;
      break;
    }

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  if (onBoundary) return 'BOUNDARY';
  return inside ? 'INSIDE' : 'OUTSIDE';
}

/**
 * Checks containment in a Polygon with outer ring and inner holes.
 */
export function pointInPolygonWithHoles(
  point: [number, number],
  rings: number[][][], // [outerRing, hole1, hole2, ...]
): 'INSIDE' | 'BOUNDARY' | 'OUTSIDE' {
  if (!rings || rings.length === 0) return 'OUTSIDE';

  const outerResult = pointInPolygon(point, rings[0]);
  if (outerResult === 'OUTSIDE') return 'OUTSIDE';
  if (outerResult === 'BOUNDARY') return 'BOUNDARY';

  // Point is inside outer ring; check if it is inside any hole
  for (let h = 1; h < rings.length; h++) {
    const holeResult = pointInPolygon(point, rings[h]);
    if (holeResult === 'BOUNDARY') return 'BOUNDARY';
    if (holeResult === 'INSIDE') {
      // Inside a hole means OUTSIDE the actual polygon geometry
      return 'OUTSIDE';
    }
  }

  return 'INSIDE';
}

export interface CandidateProjectMatch {
  project: Project;
  boundary: ProjectBoundary;
  relation: 'INSIDE' | 'BOUNDARY';
}

/**
 * Official Server-side Spatial Classification Function
 * Strictly enforcing Rules:
 * - No city-wide contractor exceptions (Aswad / others removed)
 * - Missing/inverted coords -> REVIEW_COORDINATES
 * - Incomplete boundary reference -> REVIEW_BOUNDARIES
 * - Boundary touch -> REVIEW_BOUNDARY
 * - Multiple projects -> REVIEW_OVERLAP
 * - Preliminary Handover / Withdrawn -> Excluded from active projects
 */
export function classifyViolation(
  lat: number | null | undefined,
  lng: number | null | undefined,
  activeProjects: Array<{ project: Project; boundary: ProjectBoundary }>,
  isBoundaryDatasetComplete = true,
): ClassificationResult {
  // 1. Validate Coordinates
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
    return {
      classification: 'REVIEW_COORDINATES',
      project_id: null,
      project_name: null,
      matched_contractor_id: null,
      matched_manager_id: null,
      reason: 'إحداثيات البلاغ مفقودة أو غير رقمية',
    };
  }

  // Detect likely inverted coordinates (lat/lng swapped: e.g. Riyadh lat 24, lng 46)
  if (lat >= 40.0 && lat <= 55.0 && lng >= 16.0 && lng <= 32.0) {
    return {
      classification: 'REVIEW_COORDINATES',
      project_id: null,
      project_name: null,
      matched_contractor_id: null,
      matched_manager_id: null,
      reason: 'اشتباه إحداثيات معكوسة (خط العرض وخط الطول مقلوبان) — يتطلب مراجعة',
    };
  }

  // Check valid Riyadh operational bounding box
  if (lat < 20.0 || lat > 28.5 || lng < 43.0 || lng > 49.5) {
    return {
      classification: 'REVIEW_COORDINATES',
      project_id: null,
      project_name: null,
      matched_contractor_id: null,
      matched_manager_id: null,
      reason: 'الإحداثيات خارج النطاق الجغرافي المعتمد لمنطقة الرياض',
    };
  }

  // 2. Check completeness of Boundary Dataset
  if (!isBoundaryDatasetComplete) {
    return {
      classification: 'REVIEW_BOUNDARIES',
      project_id: null,
      project_name: null,
      matched_contractor_id: null,
      matched_manager_id: null,
      reason: 'سجل النطاقات المعتمدة غير مكتمل أو قيد الاعتماد — يتطلب مراجعة',
    };
  }

  const point: [number, number] = [lng, lat]; // GeoJSON standard [lng, lat]
  const insideMatches: CandidateProjectMatch[] = [];
  const boundaryMatches: CandidateProjectMatch[] = [];

  for (const item of activeProjects) {
    const { project, boundary } = item;

    // Filter strictly to ACTIVE projects only (Rule 1 & Rule 6)
    if (project.status !== 'ACTIVE') {
      continue;
    }

    const geom = boundary.geometry;
    let relation: 'INSIDE' | 'BOUNDARY' | 'OUTSIDE' = 'OUTSIDE';

    if (geom.type === 'Polygon') {
      relation = pointInPolygonWithHoles(point, geom.coordinates as number[][][]);
    } else if (geom.type === 'MultiPolygon') {
      for (const polygonCoords of geom.coordinates as number[][][][]) {
        const polyResult = pointInPolygonWithHoles(point, polygonCoords);
        if (polyResult === 'BOUNDARY') {
          relation = 'BOUNDARY';
          break;
        } else if (polyResult === 'INSIDE') {
          relation = 'INSIDE';
          break;
        }
      }
    }

    if (relation === 'INSIDE') {
      insideMatches.push({ project, boundary, relation: 'INSIDE' });
    } else if (relation === 'BOUNDARY') {
      boundaryMatches.push({ project, boundary, relation: 'BOUNDARY' });
    }
  }

  // Case 3: Multiple Overlapping Projects (takes precedence over edge touch on one of them)
  if (insideMatches.length > 1) {
    return {
      classification: 'REVIEW_OVERLAP',
      project_id: null,
      project_name: null,
      matched_contractor_id: null,
      matched_manager_id: null,
      reason: `تداخل مكاني: النقطة تقع داخل ${insideMatches.length} مشاريع جارية معتمدة (${insideMatches.map((m) => m.project.name).join('، ')})`,
      candidate_project_ids: insideMatches.map((m) => m.project.id),
    };
  }

  // Case 4: Exactly One Active Project Match
  if (insideMatches.length === 1) {
    const match = insideMatches[0].project;
    return {
      classification: 'INSIDE_ACTIVE_PROJECT',
      project_id: match.id,
      project_name: match.name,
      matched_contractor_id: match.contractor_id,
      matched_manager_id: match.project_manager_id || null,
      reason: `داخل النطاق المعتمد للمشروع الجاري: ${match.name}`,
    };
  }

  // Case 5: Boundary edge touch (and not inside any active project)
  if (boundaryMatches.length > 0) {
    return {
      classification: 'REVIEW_BOUNDARY',
      project_id: null,
      project_name: null,
      matched_contractor_id: null,
      matched_manager_id: null,
      reason: `النقطة تقع مباشرة على حد مشروع (${boundaryMatches.map((m) => m.project.name).join('، ')}) — يتطلب مراجعة`,
      candidate_project_ids: boundaryMatches.map((m) => m.project.id),
    };
  }

  // Case 6: Confirmed Outside Active Projects
  return {
    classification: 'OUTSIDE_ACTIVE_PROJECTS',
    project_id: null,
    project_name: null,
    matched_contractor_id: null,
    matched_manager_id: null,
    reason: 'خارج كافة نطاقات المشاريع الجارية المعتمدة',
  };
}
