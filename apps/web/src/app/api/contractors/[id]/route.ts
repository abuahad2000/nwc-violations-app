import { authorize } from '@/lib/auth/guard';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authorize('contractors:read');
    if (auth.response) return auth.response;
    const { id } = await params;

    const contractor = db.prepare('SELECT * FROM contractors WHERE id = ?').get(id);
    if (!contractor) {
      return NextResponse.json({ status: 'error', message: 'المقاول غير موجود' }, { status: 404 });
    }

    // Projects belonging to this contractor
    const projects = db
      .prepare(
        `
      SELECT p.*, (SELECT COUNT(*) FROM current_violations WHERE project_id = p.id) as violations_in_project
      FROM projects p
      WHERE p.contractor_id = ?
    `,
      )
      .all(id);

    // Facet A: Violations reported in their name in source
    const reportedViolations = db
      .prepare(
        `
      SELECT
        v.id, v.source_reference, v.reported_contractor_name, v.classification,
        v.classification_reason, v.source_status, v.reported_date, v.incident_date,
        v.age_days, v.district_raw, v.street_raw, v.updated_at,
        p.name as project_name, c_proj.name as project_contractor_name,
        v.current_action_owner_id
      FROM current_violations v
      LEFT JOIN projects p ON v.project_id = p.id
      LEFT JOIN contractors c_proj ON v.project_contractor_id = c_proj.id
      WHERE v.reported_contractor_id = ? OR v.reported_contractor_name = ?
      ORDER BY v.age_days DESC
    `,
      )
      .all(id, contractor.name);

    // Facet B: Violations inside their approved project boundaries
    const boundaryViolations = db
      .prepare(
        `
      SELECT
        v.id, v.source_reference, v.reported_contractor_name, v.classification,
        v.classification_reason, v.source_status, v.reported_date, v.incident_date,
        v.age_days, v.district_raw, v.street_raw, v.updated_at,
        p.name as project_name, p.operational_number as project_op_number,
        v.current_action_owner_id
      FROM current_violations v
      JOIN projects p ON v.project_id = p.id
      WHERE v.project_contractor_id = ?
      ORDER BY v.age_days DESC
    `,
      )
      .all(id);

    // Facet C: Actions currently assigned to this contractor
    const assignedActions = db
      .prepare(
        `
      SELECT
        v.id, v.source_reference, v.reported_contractor_name, v.classification,
        v.classification_reason, v.source_status, v.reported_date, v.incident_date,
        v.age_days, v.district_raw, v.street_raw, v.updated_at,
        p.name as project_name
      FROM current_violations v
      LEFT JOIN projects p ON v.project_id = p.id
      WHERE v.current_action_owner_id = ? AND v.is_closed = 0
      ORDER BY v.age_days DESC
    `,
      )
      .all(id);

    return NextResponse.json({
      status: 'success',
      data: {
        contractor,
        projects,
        facets: {
          reported: {
            title: 'أ) البلاغات الواردة باسم المقاول في المصدر',
            description:
              'البلاغات التي ورد فيها اسم المقاول صراحة في ملف التعديات الوارد من الأمانة أو الجهة المبلغة',
            count: reportedViolations.length,
            items: reportedViolations,
          },
          boundary: {
            title: 'ب) البلاغات الواقعة داخل نطاق مشاريعه المعتمدة مكانياً',
            description:
              'التعديات التي أثبت محرك المعالجة المكانية وقوع إحداثياتها داخل الحدود الجغرافية للمشروع المكلف به المقاول',
            count: boundaryViolations.length,
            items: boundaryViolations,
          },
          assigned: {
            title: 'ج) الإجراءات المسندة إلى المقاول حالياً',
            description:
              'البلاغات المفتوحة والمهام المسندة لمكتب المقاول للمعالجة الميدانية والتنسيق الفني',
            count: assignedActions.length,
            items: assignedActions,
          },
        },
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        message: (err instanceof Error && err.message) || 'فشل جلب تفاصيل المقاول',
      },
      { status: 500 },
    );
  }
}
