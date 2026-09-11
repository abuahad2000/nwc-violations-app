import { NextResponse } from 'next/server';
import { authorize } from '@/lib/auth/guard';
import { db } from '@/lib/db/async';
import { parseFilters, buildViolationFilter } from '@/lib/domain/filters';
export async function GET(req: Request) {
  const auth = await authorize('violations:read');
  if (auth.response) return auth.response;
  try {
    const { whereSQL, params } = buildViolationFilter(
      parseFilters(new URL(req.url).searchParams),
      auth.user,
    );
    const rows = await db
      .prepare(
        `SELECT v.id,v.source_reference,v.latitude,v.longitude,v.classification FROM current_violations v LEFT JOIN projects p ON p.id=v.project_id LEFT JOIN contractors c_proj ON c_proj.id=v.project_contractor_id WHERE ${whereSQL} AND v.latitude BETWEEN 15 AND 32 AND v.longitude BETWEEN 34 AND 56 ORDER BY v.id LIMIT 10001`,
      )
      .all(...params);
    if (rows.length > 10000)
      return NextResponse.json({ message: 'ضيّق الفلاتر لعرض أقل من 10000 نقطة' }, { status: 422 });
    const boundaries =
      auth.user.role === 'CONTRACTOR_USER'
        ? []
        : await db
            .prepare(
              "SELECT b.geometry_json,p.name,b.is_approved FROM project_boundaries b JOIN projects p ON p.id=b.project_id WHERE b.is_approved=1 AND p.status='ACTIVE'",
            )
            .all();
    return NextResponse.json({
      points: {
        type: 'FeatureCollection',
        features: rows.map((r) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
          properties: { id: r.id, reference: r.source_reference, classification: r.classification },
        })),
      },
      boundaries: {
        type: 'FeatureCollection',
        features: boundaries.map((b) => ({
          type: 'Feature',
          geometry: JSON.parse(String(b.geometry_json)),
          properties: { name: b.name, approved: b.is_approved },
        })),
      },
    });
  } catch {
    return NextResponse.json({ message: 'تعذر تحميل الخريطة' }, { status: 400 });
  }
}
