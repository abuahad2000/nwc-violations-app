import { NextResponse } from 'next/server';
import { authorize } from '@/lib/auth/guard';
import { db } from '@/lib/db/async';
export async function GET() {
  const auth = await authorize('projects:read');
  if (auth.response) return auth.response;
  try {
    const data = await db.transaction(async () => {
      const summary = await db
        .prepare(
          `SELECT count(*) total,COALESCE(sum(is_closed),0) closed,COALESCE(sum(CASE WHEN is_closed=0 THEN 1 ELSE 0 END),0) pending,COALESCE(sum(CASE WHEN is_closed=0 AND age_days>180 THEN 1 ELSE 0 END),0) over180,COALESCE(sum(CASE WHEN is_closed=0 AND NOT EXISTS(SELECT 1 FROM contractors c WHERE c.id=v.current_action_owner_id) THEN 1 ELSE 0 END),0) unassigned FROM current_violations v`,
        )
        .get();
      const projects = await db
        .prepare(
          `SELECT p.id,p.name,p.status,p.operational_number,c.name contractor_name,(SELECT count(*) FROM current_violations v WHERE v.project_id=p.id) total,(SELECT count(*) FROM current_violations v WHERE v.project_id=p.id AND v.is_closed=0) pending FROM projects p LEFT JOIN contractors c ON c.id=p.contractor_id WHERE p.status!='REVIEW' AND EXISTS(SELECT 1 FROM current_violations v WHERE v.project_id=p.id) ORDER BY pending DESC,p.name`,
        )
        .all();
      const contractors = await db
        .prepare(
          `SELECT c.id,c.name,count(*) pending,COALESCE(sum(CASE WHEN v.age_days>180 THEN 1 ELSE 0 END),0) over180 FROM contractors c JOIN current_violations v ON v.current_action_owner_id=c.id WHERE v.is_closed=0 GROUP BY c.id,c.name ORDER BY pending DESC,c.name`,
        )
        .all();
      return { summary, projects, contractors };
    });
    return NextResponse.json({ ...data, generated_at: new Date().toISOString() });
  } catch {
    return NextResponse.json({ message: 'تعذر إعداد الإنفوجرافيك' }, { status: 500 });
  }
}
