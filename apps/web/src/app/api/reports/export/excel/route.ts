import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/async';
import { authorize } from '@/lib/auth/guard';
import { parseFilters, buildViolationFilter } from '@/lib/domain/filters';
import { ZodError } from 'zod';
import { programNameSQL } from '@/lib/domain/manager';
import { exportViolationsWorkbook } from '@/lib/reports/excel';

export async function GET(req: NextRequest) {
  try {
    const auth = await authorize('reports:export');
    if (auth.response) return auth.response;
    const filters = parseFilters(new URL(req.url).searchParams);
    const { whereSQL, params } = buildViolationFilter(filters, auth.user);

    const rows = await db
      .prepare(
        `
      SELECT 
        v.source_reference as "رقم البلاغ",
        v.reported_contractor_name as "مقاول المصدر (المبلغ عنه)",
        c_proj.name as "مقاول المشروع المكاني المعتمد",
        p.name as "اسم المشروع المكاني",
        p.operational_number as "الرقم التشغيلي للمشروع",
        p.project_manager_name as "مدير المشروع للمتابعة",
        p.executive_director_name as "المدير التنفيذي",
        p.subprogram_name as "الإدارة / البرنامج الفرعي",
        ${programNameSQL} as "مدير البرنامج",
        (SELECT name FROM contractors WHERE id=v.current_action_owner_id) as "مسؤول الإجراء الحالي",
        CASE 
          WHEN v.classification = 'INSIDE_PROJECT_BOUNDARY' THEN 'داخل نطاق مشروع معتمد'
          WHEN v.classification = 'OUTSIDE_PROJECT_BOUNDARY' THEN 'خارج المشروع (اختصاص الصيانة)'
          ELSE 'تحت المراجعة والتدقيق'
        END as "التصنيف المكاني",
        v.classification_reason as "سبب التصنيف المكاني",
        v.source_status as "حالة البلاغ في المصدر",
        v.age_days as "عمر البلاغ (بالأيام)",
        v.reported_date as "تاريخ البلاغ",
        v.incident_date as "تاريخ التعدي",
        v.district_raw as "الحي",
        v.street_raw as "الشارع",
        v.city_raw as "المدينة",
        v.latitude as "خط العرض",
        v.longitude as "خط الطول",
        v.description_raw as "وصف التعدي",
        v.updated_at as "تاريخ آخر تحديث"
      FROM current_violations v
      LEFT JOIN projects p ON v.project_id = p.id
      LEFT JOIN contractors c_proj ON v.project_contractor_id = c_proj.id
      WHERE ${whereSQL}
      ORDER BY v.age_days DESC
    `,
      )
      .all(...params);

    const buffer = await exportViolationsWorkbook(rows);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `NWC_Violations_Report_${timestamp}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ message: 'فلاتر غير صالحة' }, { status: 400 });
    return NextResponse.json(
      {
        status: 'error',
        message: (err instanceof Error && err.message) || 'فشل توليد وتصدير ملف الإكسل',
      },
      { status: 500 },
    );
  }
}
