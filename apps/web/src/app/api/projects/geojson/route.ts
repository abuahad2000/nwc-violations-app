import { NextResponse } from 'next/server';
import { authorize } from '@/lib/auth/guard';
import { db } from '@/lib/db/async';
export async function GET() {
  const auth = await authorize('projects:read'); if (auth.response) return auth.response;
  try {
    const rows = await db.prepare(`SELECT p.id,p.name,p.operational_number,p.status,b.geometry_json FROM projects p JOIN project_boundaries b ON b.project_id=p.id WHERE p.status='ACTIVE' AND b.is_approved=1`).all();
    return NextResponse.json({ type: 'FeatureCollection', features: rows.map((row) => ({ type: 'Feature', geometry: JSON.parse(String(row.geometry_json)), properties: { id: row.id, name: row.name, operational_number: row.operational_number, status: row.status } })) });
  } catch { return NextResponse.json({ message: 'تعذر تحميل نطاقات المشاريع' }, { status: 500 }); }
}
