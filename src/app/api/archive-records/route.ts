import { NextRequest, NextResponse } from 'next/server';
import {
  exportArchiveRecordsController,
  getArchiveRecordsController,
  listAvailableYearsController,
} from '@/controllers/archiveRecordsController';

function parseYear(value: string | null) {
  const y = Number(value);
  if (!Number.isInteger(y)) return new Date().getFullYear();
  return y;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseYear(searchParams.get('year'));
    const moduleName = searchParams.get('module') || undefined;
    const mode = (searchParams.get('mode') || 'list').toLowerCase();
    const format = (searchParams.get('format') || 'json').toLowerCase();
    
    if (mode === 'years') {
      const years = await listAvailableYearsController();
      return NextResponse.json({ years }, { status: 200 });
    }

    if (mode === 'export') {
      const file = await exportArchiveRecordsController(year, moduleName, format);
      const responseBody = typeof file.body === 'string' ? file.body : new Uint8Array(file.body);
      return new NextResponse(responseBody, {
        status: 200,
        headers: {
          'Content-Type': file.contentType,
          'Content-Disposition': `attachment; filename="${file.filename}"`,
        },
      });
    }

    const records = await getArchiveRecordsController(year, moduleName);
    return NextResponse.json({ records }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
