import { NextResponse } from 'next/server';
import { authorize } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { commitImport, previewImport } from '@/lib/imports/service';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
export async function GET() {
  const auth = await authorize('imports:execute');
  if (auth.response) return auth.response;
  const data = db
    .prepare(
      'SELECT b.*, u.name AS imported_by_name FROM import_batches b LEFT JOIN users u ON b.imported_by = u.id ORDER BY b.created_at DESC LIMIT 100',
    )
    .all();
  return NextResponse.json({ status: 'success', data });
}
export async function POST(req: Request) {
  const auth = await authorize('imports:execute', req);
  if (auth.response) return auth.response;
  try {
    const body = z
      .discriminatedUnion('action', [
        z.object({ action: z.literal('preview-local') }),
        z.object({ action: z.literal('commit'), preview_id: z.string().uuid() }),
      ])
      .parse(await req.json());
    if (body.action === 'preview-local') {
      const file = path.resolve(process.cwd(), '../../excel/التعديات.xlsx');
      return NextResponse.json({
        status: 'success',
        ...(await previewImport(await fs.readFile(file), 'التعديات.xlsx', auth.user.id)),
      });
    }
    return NextResponse.json({ status: 'success', ...commitImport(body.preview_id, auth.user.id) });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'فشل الاستيراد' },
      { status: 400 },
    );
  }
}
