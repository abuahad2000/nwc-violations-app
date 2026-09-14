import { NextResponse } from 'next/server';
import { authorize } from '@/lib/auth/guard';
import { db } from '@/lib/db/async';
export async function GET() {
  const auth = await authorize('violations:read'); if (auth.response) return auth.response;
  try {
    const rows = await db.prepare(`SELECT v.id,v.source_reference,v.source_status,v.is_closed,v.latitude,v.longitude,v.project_id,p.name project_name,v.district_raw,v.street_raw FROM current_violations v LEFT JOIN projects p ON p.id=v.project_id WHERE v.latitude IS NOT NULL AND v.longitude IS NOT NULL AND v.latitude BETWEEN 15 AND 32 AND v.longitude BETWEEN 34 AND 56 LIMIT 10000`).all();
    return NextResponse.json({ type: 'FeatureCollection', features: rows.map((row) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [Number(row.longitude), Number(row.latitude)] }, properties: { ...row, is_closed: Boolean(row.is_closed) } })) });
  } catch { return NextResponse.json({ message: 'تعذر تحميل نقاط البلاغات' }, { status: 500 }); }
}
