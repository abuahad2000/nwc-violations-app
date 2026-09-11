import { NextResponse } from 'next/server';
import { authorize } from '@/lib/auth/guard';
import { previewImport } from '@/lib/imports/service';
import { MAX_FILE_BYTES } from '@/lib/imports/workbook';
export async function POST(req: Request) {
  const auth = await authorize('imports:execute', req);
  if (auth.response) return auth.response;
  if (Number(req.headers.get('content-length')) > MAX_FILE_BYTES + 100000)
    return NextResponse.json({ message: 'الملف أكبر من الحد المسموح' }, { status: 413 });
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (
      !(file instanceof File) ||
      !file.name.toLowerCase().endsWith('.xlsx') ||
      file.size > MAX_FILE_BYTES
    )
      return NextResponse.json({ message: 'اختر ملف XLSX لا يتجاوز 10MB' }, { status: 400 });
    return NextResponse.json({
      status: 'success',
      ...(await previewImport(Buffer.from(await file.arrayBuffer()), file.name, auth.user.id)),
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'فشل المعاينة' },
      { status: 400 },
    );
  }
}
