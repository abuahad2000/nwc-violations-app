import { Pool } from 'pg';
import type { PolygonGeometry, SpatialClassification } from '@/types';
const globalPool = globalThis as unknown as { nwcPostgis?: Pool };
export function postgis() {
  if (!(process.env.POSTGIS_URL || process.env.DATABASE_URL))
    throw new Error('لم يتم إعداد اتصال PostGIS المحلي');
  return (globalPool.nwcPostgis ??= new Pool({
    connectionString: process.env.POSTGIS_URL || process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 5000,
    statement_timeout: 30000,
  }));
}
export type SpatialInput = { id: string; latitude: number | null; longitude: number | null };
export type ApprovedBoundary = {
  project_id: string;
  contractor_id: string;
  geometry: PolygonGeometry;
};
export type SpatialResult = {
  id: string;
  classification: SpatialClassification;
  project_id: string | null;
  contractor_id: string | null;
};
export async function classifyWithPostgis(
  points: SpatialInput[],
  boundaries: ApprovedBoundary[],
  referenceComplete: boolean,
): Promise<SpatialResult[]> {
  const result = await postgis().query<SpatialResult>(
    `
 WITH points AS (SELECT x.*, CASE WHEN latitude BETWEEN 15 AND 32 AND longitude BETWEEN 34 AND 56 THEN ST_SetSRID(ST_MakePoint(longitude,latitude),4326) END point FROM jsonb_to_recordset($1::jsonb) AS x(id text,latitude float8,longitude float8)),
 boundaries AS (SELECT x.project_id,x.contractor_id,ST_SetSRID(ST_GeomFromGeoJSON(x.geometry),4326) geom FROM jsonb_to_recordset($2::jsonb) AS x(project_id text,contractor_id text,geometry jsonb)),
 valid AS (SELECT * FROM boundaries WHERE ST_IsValid(geom) AND ST_GeometryType(geom) IN ('ST_Polygon','ST_MultiPolygon')),
 matches AS (SELECT p.id,p.point,count(DISTINCT b.project_id) FILTER(WHERE ST_Contains(b.geom,p.point)) n_inside,
 count(DISTINCT b.project_id) FILTER(WHERE ST_Covers(b.geom,p.point) AND NOT ST_Contains(b.geom,p.point)) n_edge,
 min(b.project_id) FILTER(WHERE ST_Contains(b.geom,p.point)) project_id,
 min(b.contractor_id) FILTER(WHERE ST_Contains(b.geom,p.point)) contractor_id
 FROM points p LEFT JOIN valid b ON ST_Covers(b.geom,p.point) GROUP BY p.id,p.point),
 results AS (SELECT *, CASE WHEN point IS NULL THEN 'REVIEW_COORDINATES'
 WHEN n_edge>0 THEN 'REVIEW_BOUNDARY' WHEN n_inside>1 THEN 'REVIEW_OVERLAP'
 WHEN n_inside=1 THEN 'INSIDE_ACTIVE_PROJECT'
 WHEN NOT $3::boolean OR (SELECT count(*) FROM valid)!=(SELECT count(*) FROM boundaries) OR (SELECT count(*) FROM valid)=0 THEN 'REVIEW_BOUNDARIES'
 ELSE 'OUTSIDE_ACTIVE_PROJECTS' END classification FROM matches)
 SELECT id,classification,CASE WHEN classification='INSIDE_ACTIVE_PROJECT' THEN project_id END project_id,
 CASE WHEN classification='INSIDE_ACTIVE_PROJECT' THEN contractor_id END contractor_id FROM results
 `,
    [JSON.stringify(points), JSON.stringify(boundaries), referenceComplete],
  );
  return result.rows;
}
export const classificationReason: Record<SpatialClassification, string> = {
  INSIDE_ACTIVE_PROJECT: 'داخل الحدود المعتمدة لمشروع جارٍ',
  OUTSIDE_ACTIVE_PROJECTS: 'خارج كامل مرجع المشاريع الجارية المعتمد',
  REVIEW_COORDINATES: 'إحداثيات مفقودة أو مشتبه بها',
  REVIEW_BOUNDARIES: 'مرجع الحدود غير مكتمل؛ لا يمكن الجزم بأنه خارج المشاريع',
  REVIEW_OVERLAP: 'داخل أكثر من مشروع؛ يلزم حسم التداخل',
  REVIEW_BOUNDARY: 'النقطة تقع على حد مشروع؛ يلزم التدقيق',
};
