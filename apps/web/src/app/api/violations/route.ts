import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/async';
import { authorize } from '@/lib/auth/guard';
import { parseFilters, buildViolationFilter } from '@/lib/domain/filters';
import { ZodError } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const auth = await authorize('violations:read');
    if (auth.response) return auth.response;
    const filters = parseFilters(new URL(req.url).searchParams);
    const { whereSQL, params } = buildViolationFilter(filters, auth.user);
    const { page, limit } = filters;
    const offset = (page - 1) * limit;

    // Total matching count
    const countQuery = `
      SELECT count(*) as total
      FROM current_violations v
      LEFT JOIN projects p ON v.project_id = p.id
      LEFT JOIN contractors c_proj ON v.project_contractor_id = c_proj.id
      WHERE ${whereSQL}
    `;
    const totalRow = (await db.prepare(countQuery).get(...params)) as { total: number };

    // Select page rows
    const dataQuery = `
      SELECT
        v.id,
        v.source_reference,
        COALESCE((SELECT name FROM contractors WHERE id=v.reported_contractor_id),v.reported_contractor_name) as reported_contractor_name,
        v.reported_contractor_name as source_reported_contractor_name,
        v.reported_contractor_id,
        v.project_contractor_id,
        v.current_action_owner_id,
        v.project_id,
        v.latitude,
        v.longitude,
        v.classification,
        v.classification_reason,
        v.source_status,
        v.reported_date,
        v.incident_date,
        v.age_days,
        v.description_raw,
        v.district_raw,
        v.street_raw,
        v.city_raw,
        v.is_closed,
        v.updated_at,
        p.name as project_name,
        p.operational_number as project_op_number,
        c_proj.name as project_contractor_name
      FROM current_violations v
      LEFT JOIN projects p ON v.project_id = p.id
      LEFT JOIN contractors c_proj ON v.project_contractor_id = c_proj.id
      WHERE ${whereSQL}
      ORDER BY v.age_days DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await db.prepare(dataQuery).all(...params, limit, offset);

    return NextResponse.json({
      status: 'success',
      data: rows,
      pagination: {
        total: totalRow.total,
        page,
        limit,
        totalPages: Math.ceil(totalRow.total / limit),
      },
    });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ message: 'فلاتر غير صالحة' }, { status: 400 });
    return NextResponse.json(
      {
        status: 'error',
        message: (err instanceof Error && err.message) || 'فشل جلب قائمة البلاغات',
      },
      { status: 500 },
    );
  }
}
